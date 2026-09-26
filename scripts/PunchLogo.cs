using System;
using System.Collections.Generic;
using System.Drawing;
using System.Drawing.Imaging;
using System.IO;
using System.Runtime.InteropServices;

class PunchLogo
{
    static Color PixelAt(byte[] bytes, int stride, int x, int y)
    {
        int i = y * stride + x * 4;
        return Color.FromArgb(bytes[i + 3], bytes[i + 2], bytes[i + 1], bytes[i]);
    }

    static void SetA(byte[] bytes, int stride, int x, int y, byte a)
    {
        bytes[y * stride + x * 4 + 3] = a;
    }

    static bool IsWhite(Color c, int avgMin)
    {
        int avg = (c.R + c.G + c.B) / 3;
        int spread = Math.Max(c.R, Math.Max(c.G, c.B)) - Math.Min(c.R, Math.Min(c.G, c.B));
        return avg >= avgMin && spread <= 28;
    }

    static bool IsNavy(Color c)
    {
        return c.A > 10 && c.R < 70 && c.G < 90 && c.B > 40 && c.B > c.R + 12;
    }

    static Bitmap To32(Image src)
    {
        var bmp = new Bitmap(src.Width, src.Height, PixelFormat.Format32bppArgb);
        using (var g = Graphics.FromImage(bmp))
        {
            g.CompositingMode = System.Drawing.Drawing2D.CompositingMode.SourceCopy;
            g.DrawImage(src, 0, 0, src.Width, src.Height);
        }
        return bmp;
    }

    static void FloodWhite(byte[] bytes, int stride, int w, int h, Queue<int> seeds, int avgMin, bool[] visited)
    {
        var q = seeds;
        while (q.Count > 0)
        {
            int p = q.Dequeue();
            int x = p % w, y = p / w;
            if (x < 0 || y < 0 || x >= w || y >= h) continue;
            int vi = y * w + x;
            if (visited[vi]) continue;
            visited[vi] = true;
            Color c = PixelAt(bytes, stride, x, y);
            if (c.A == 0 || !IsWhite(c, avgMin)) continue;
            SetA(bytes, stride, x, y, 0);
            if (x + 1 < w) q.Enqueue(p + 1);
            if (x > 0) q.Enqueue(p - 1);
            if (y + 1 < h) q.Enqueue(p + w);
            if (y > 0) q.Enqueue(p - w);
        }
    }

    static void PunchWhite(Bitmap bmp)
    {
        int w = bmp.Width, h = bmp.Height;
        var data = bmp.LockBits(new Rectangle(0, 0, w, h), ImageLockMode.ReadWrite, PixelFormat.Format32bppArgb);
        var bytes = new byte[Math.Abs(data.Stride) * h];
        Marshal.Copy(data.Scan0, bytes, 0, bytes.Length);
        int stride = data.Stride;

        var visited = new bool[w * h];
        var edge = new Queue<int>();
        for (int x = 0; x < w; x++)
        {
            edge.Enqueue(x);
            edge.Enqueue(x + (h - 1) * w);
        }
        for (int y = 0; y < h; y++)
        {
            edge.Enqueue(y * w);
            edge.Enqueue((w - 1) + y * w);
        }
        FloodWhite(bytes, stride, w, h, edge, 228, visited);

        int iconMinX = w, iconMinY = h, iconMaxX = 0, iconMaxY = 0;
        int seed = -1;
        for (int x = 0; x < w && seed < 0; x++)
        {
            for (int y = 0; y < h; y++)
            {
                Color c = PixelAt(bytes, stride, x, y);
                if (c.A > 10 && IsNavy(c)) { seed = y * w + x; break; }
            }
        }
        if (seed >= 0)
        {
            var nq = new Queue<int>();
            var nseen = new bool[w * h];
            nq.Enqueue(seed);
            while (nq.Count > 0)
            {
                int p = nq.Dequeue();
                int x = p % w, y = p / w;
                if (x < 0 || y < 0 || x >= w || y >= h) continue;
                int vi = y * w + x;
                if (nseen[vi]) continue;
                nseen[vi] = true;
                Color c = PixelAt(bytes, stride, x, y);
                if (c.A == 0 || !IsNavy(c)) continue;
                if (x < iconMinX) iconMinX = x;
                if (y < iconMinY) iconMinY = y;
                if (x > iconMaxX) iconMaxX = x;
                if (y > iconMaxY) iconMaxY = y;
                if (x + 1 < w) nq.Enqueue(p + 1);
                if (x > 0) nq.Enqueue(p - 1);
                if (y + 1 < h) nq.Enqueue(p + w);
                if (y > 0) nq.Enqueue(p - w);
            }
        }
        int pad = Math.Max(4, (iconMaxX - iconMinX) / 30);
        iconMinX = Math.Max(0, iconMinX - pad);
        iconMinY = Math.Max(0, iconMinY - pad);
        iconMaxX = Math.Min(w - 1, iconMaxX + pad);
        iconMaxY = Math.Min(h - 1, iconMaxY + pad);

        var holes = new Queue<int>();
        var holeVisit = new bool[w * h];
        for (int y = 0; y < h; y++)
        {
            for (int x = 0; x < w; x++)
            {
                bool insideIcon = x >= iconMinX && x <= iconMaxX && y >= iconMinY && y <= iconMaxY;
                if (insideIcon) continue;
                Color c = PixelAt(bytes, stride, x, y);
                if (c.A == 0 || !IsWhite(c, 210)) continue;
                holes.Enqueue(y * w + x);
            }
        }
        FloodWhite(bytes, stride, w, h, holes, 210, holeVisit);

        for (int pass = 0; pass < 4; pass++)
        {
            for (int y = 1; y < h - 1; y++)
            {
                for (int x = 1; x < w - 1; x++)
                {
                    int i = y * stride + x * 4;
                    if (bytes[i + 3] == 0) continue;
                    bool nearClear = false;
                    int[] ox = { 1, -1, 0, 0, 1, 1, -1, -1 };
                    int[] oy = { 0, 0, 1, -1, 1, -1, 1, -1 };
                    for (int k = 0; k < 8; k++)
                    {
                        int j = (y + oy[k]) * stride + (x + ox[k]) * 4;
                        if (bytes[j + 3] == 0) { nearClear = true; break; }
                    }
                    if (!nearClear) continue;
                    Color c = PixelAt(bytes, stride, x, y);
                    int minC = Math.Min(c.R, Math.Min(c.G, c.B));
                    if (minC >= 130)
                    {
                        SetA(bytes, stride, x, y, 0);
                    }
                    else if (minC >= 18)
                    {
                        int nr = Math.Max(0, c.R - minC);
                        int ng = Math.Max(0, c.G - minC);
                        int nb = Math.Max(0, c.B - minC);
                        int a = Math.Max(0, c.A * (255 - minC) / 255);
                        bytes[i] = (byte)nb;
                        bytes[i + 1] = (byte)ng;
                        bytes[i + 2] = (byte)nr;
                        bytes[i + 3] = (byte)a;
                    }
                }
            }
        }

        Marshal.Copy(bytes, 0, data.Scan0, bytes.Length);
        bmp.UnlockBits(data);
    }

    static Bitmap Crop(Bitmap bmp, int pad)
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
        minX = Math.Max(0, minX - pad);
        minY = Math.Max(0, minY - pad);
        maxX = Math.Min(w - 1, maxX + pad);
        maxY = Math.Min(h - 1, maxY + pad);
        int cw = maxX - minX + 1, ch = maxY - minY + 1;
        var cropped = new Bitmap(cw, ch, PixelFormat.Format32bppArgb);
        using (var g = Graphics.FromImage(cropped))
        {
            g.Clear(Color.Transparent);
            g.DrawImage(bmp, new Rectangle(0, 0, cw, ch), new Rectangle(minX, minY, cw, ch), GraphicsUnit.Pixel);
        }
        return cropped;
    }

    static int Main(string[] args)
    {
        string input = args[0], output = args[1];
        using (var srcImg = Image.FromFile(input))
        using (var src = To32(srcImg))
        {
            PunchWhite(src);
            using (var cropped = Crop(src, 6))
                cropped.Save(output, ImageFormat.Png);
        }
        Console.WriteLine("ok");
        return 0;
    }
}
