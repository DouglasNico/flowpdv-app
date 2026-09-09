/**
 * Promove o rascunho criado pelo electron-builder para release publicada.
 * O GitHub recusa criar release publicada com tag inexistente (422); ao sair
 * do rascunho ele cria a tag automaticamente a partir do branch padrao.
 */
const pkg = require('../package.json');

const token = process.env.GH_TOKEN || process.env.GITHUB_TOKEN;
const destino = (pkg.build && pkg.build.publish && pkg.build.publish[0]) || {};
const owner = destino.owner;
const repo = destino.repo;
const tag = `v${pkg.version}`;
const esperados = ['FlowPDV-Setup.exe', 'latest.yml'];

if (!token) {
  console.error('GH_TOKEN nao definido. Configure a variavel de ambiente antes de publicar.');
  process.exit(1);
}

async function api(caminho, opcoes = {}) {
  const resposta = await fetch(`https://api.github.com${caminho}`, {
    ...opcoes,
    headers: {
      Authorization: `Bearer ${token}`,
      Accept: 'application/vnd.github+json',
      'X-GitHub-Api-Version': '2022-11-28',
      'User-Agent': 'flowpdv-release',
      ...(opcoes.body ? { 'Content-Type': 'application/json' } : {})
    }
  });
  const texto = await resposta.text();
  if (!resposta.ok) {
    throw new Error(`${opcoes.method || 'GET'} ${caminho} -> ${resposta.status}: ${texto}`);
  }
  return texto ? JSON.parse(texto) : null;
}

(async () => {
  const releases = await api(`/repos/${owner}/${repo}/releases?per_page=100`);
  const daVersao = releases.filter((r) => r.tag_name === tag);
  const release = daVersao.find((r) => esperados.every((nome) => r.assets.some((a) => a.name === nome)));

  if (!release) {
    throw new Error(`Nenhuma release com a tag ${tag} e os arquivos ${esperados.join(', ')} em ${owner}/${repo}.`);
  }

  const enviados = release.assets.map((a) => a.name);
  const faltando = esperados.filter((nome) => !enviados.includes(nome));
  if (faltando.length) {
    throw new Error(`Arquivos ausentes na release ${tag}: ${faltando.join(', ')}`);
  }

  if (!release.draft) {
    console.log(`Release ${tag} ja esta publicada: ${release.html_url}`);
    return;
  }

  const publicada = await api(`/repos/${owner}/${repo}/releases/${release.id}`, {
    method: 'PATCH',
    body: JSON.stringify({ draft: false, name: tag, make_latest: 'true' })
  });

  console.log(`Release ${tag} publicada: ${publicada.html_url}`);
  console.log(`Arquivos: ${enviados.join(', ')}`);
})().catch((erro) => {
  console.error(erro.message);
  process.exit(1);
});
