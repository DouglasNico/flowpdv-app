using System;
using System.Collections.Generic;
using System.Drawing;
using System.Drawing.Drawing2D;
using System.Drawing.Imaging;
using System.IO;
using System.Runtime.InteropServices;

class PunchIcon
{
    static int Dist(Color a, Color b)
    {
        return Math.Abs(a.R - b.R) + Math.Abs(a.G - b.G) + Math.Abs(a.B - b.B);
    }

    static Bitmap To32(Image src)
    {
        var bmp = new Bitmap(src.Width, src.Height, PixelFormat.Format32bppArgb);
        using (var g = Graphics.FromImage(bmp))
        {
            g.CompositingMode = CompositingMode.SourceCopy;
            g.DrawImage(src, 0, 0, src.Width, src.Height);
        }
        return bmp;
    }

    static Bitmap Scale(Bitmap src, int size)
    {
        var bmp = new Bitmap(size, size, PixelFormat.Format32bppArgb);
        using (var g = Graphics.FromImage(bmp))
        {
            g.Clear(Color.Transparent);
            g.InterpolationMode = InterpolationMode.HighQualityBicubic;
            g.SmoothingMode = SmoothingMode.HighQuality;
            g.PixelOffsetMode = PixelOffsetMode.HighQuality;
            g.DrawImage(src, 0, 0, size, size);
        }
        return bmp;
    }

    static Color PixelAt(byte[] bytes, int stride, int x, int y)
    {
        int i = y * stride + x * 4;
        return Color.FromArgb(bytes[i + 3], bytes[i + 2], bytes[i + 1], bytes[i]);
    }

    static bool IsCanvas(Color c)
    {
        int avg = (c.R + c.G + c.B) / 3;
        int spread = Math.Max(c.R, Math.Max(c.G, c.B)) - Math.Min(c.R, Math.Min(c.G, c.B));
        if (avg < 50) return true;
        if (spread < 24 && avg >= 50) return true;
        if (avg > 160 && spread < 36) return true;
        return false;
    }

    static void Punch(Bitmap bmp, int tolerance)
    {
        int w = bmp.Width, h = bmp.Height;
        var rect = new Rectangle(0, 0, w, h);
        var data = bmp.LockBits(rect, ImageLockMode.ReadWrite, PixelFormat.Format32bppArgb);
        var bytes = new byte[Math.Abs(data.Stride) * h];
        Marshal.Copy(data.Scan0, bytes, 0, bytes.Length);
        int stride = data.Stride;

        var visited = new bool[w * h];
        var q = new Queue<int>();
        for (int x = 0; x < w; x++)
        {
            q.Enqueue(x);
            q.Enqueue(x + (h - 1) * w);
        }
        for (int y = 0; y < h; y++)
        {
            q.Enqueue(y * w);
            q.Enqueue((w - 1) + y * w);
        }

        while (q.Count > 0)
        {
            int p = q.Dequeue();
            int x = p % w, y = p / w;
            if (x < 0 || y < 0 || x >= w || y >= h) continue;
            int vi = y * w + x;
            if (visited[vi]) continue;
            visited[vi] = true;
            if (!IsCanvas(PixelAt(bytes, stride, x, y))) continue;
            bytes[y * stride + x * 4 + 3] = 0;
            if (x + 1 < w) q.Enqueue(p + 1);
            if (x > 0) q.Enqueue(p - 1);
            if (y + 1 < h) q.Enqueue(p + w);
            if (y > 0) q.Enqueue(p - w);
        }

        for (int y = 1; y < h - 1; y++)
        {
            for (int x = 1; x < w - 1; x++)
            {
                int i = y * stride + x * 4;
                if (bytes[i + 3] == 0) continue;
                bool near = bytes[i + 4 + 3] == 0 || bytes[i - 4 + 3] == 0
                    || bytes[i + stride + 3] == 0 || bytes[i - stride + 3] == 0;
                if (near && IsCanvas(PixelAt(bytes, stride, x, y)))
                    bytes[i + 3] = 0;
            }
        }

        Marshal.Copy(bytes, 0, data.Scan0, bytes.Length);
        bmp.UnlockBits(data);
    }

    static Bitmap Crop(Bitmap bmp)
    {
        int w = bmp.Width, h = bmp.Height;
        int minX = w, minY = h, maxX = 0, maxY = 0;
        for (int y = 0; y < h; y++)
        {
            for (int x = 0; x < w; x++)
            {
                if (bmp.GetPixel(x, y).A > 8)
                {
                    if (x < minX) minX = x;
                    if (y < minY) minY = y;
                    if (x > maxX) maxX = x;
                    if (y > maxY) maxY = y;
                }
            }
        }
        if (maxX <= minX) return (Bitmap)bmp.Clone();
        int pad = Math.Max(4, (int)((maxX - minX) * 0.02));
        minX = Math.Max(0, minX - pad);
        minY = Math.Max(0, minY - pad);
        maxX = Math.Min(w - 1, maxX + pad);
        maxY = Math.Min(h - 1, maxY + pad);
        int cw = maxX - minX + 1, ch = maxY - minY + 1;
        int side = Math.Max(cw, ch);
        var cropped = new Bitmap(side, side, PixelFormat.Format32bppArgb);
        using (var g = Graphics.FromImage(cropped))
        {
            g.Clear(Color.Transparent);
            g.InterpolationMode = InterpolationMode.HighQualityBicubic;
            g.DrawImage(bmp,
                new Rectangle((side - cw) / 2, (side - ch) / 2, cw, ch),
                new Rectangle(minX, minY, cw, ch),
                GraphicsUnit.Pixel);
        }
        return cropped;
    }

    static void SaveIco(Bitmap source, string path)
    {
        int[] sizes = { 16, 24, 32, 48, 64, 128, 256 };
        var blobs = new List<byte[]>();
        foreach (int s in sizes)
        {
            using (var b = Scale(source, s))
            using (var ms = new MemoryStream())
            {
                b.Save(ms, ImageFormat.Png);
                blobs.Add(ms.ToArray());
            }
        }
        using (var fs = File.Create(path))
        using (var bw = new BinaryWriter(fs))
        {
            bw.Write((ushort)0);
            bw.Write((ushort)1);
            bw.Write((ushort)blobs.Count);
            int offset = 6 + 16 * blobs.Count;
            for (int i = 0; i < blobs.Count; i++)
            {
                int s = sizes[i];
                bw.Write((byte)(s >= 256 ? 0 : s));
                bw.Write((byte)(s >= 256 ? 0 : s));
                bw.Write((byte)0);
                bw.Write((byte)0);
                bw.Write((ushort)1);
                bw.Write((ushort)32);
                bw.Write((uint)blobs[i].Length);
                bw.Write((uint)offset);
                offset += blobs[i].Length;
            }
            foreach (var blob in blobs) bw.Write(blob);
        }
    }

    static int Main(string[] args)
    {
        string input = args[0], pngOut = args[1], icoOut = args[2];
        using (var srcImg = Image.FromFile(input))
        using (var src = To32(srcImg))
        {
            Punch(src, 52);
            using (var cropped = Crop(src))
            using (var master = Scale(cropped, 512))
            {
                master.Save(pngOut, ImageFormat.Png);
                using (var icoMaster = Scale(cropped, 256))
                    SaveIco(icoMaster, icoOut);
            }
        }
        Console.WriteLine("ok");
        return 0;
    }
}
