# Parte 2C — provisionamento e pareamento no servidor

Continuação: a interface de validação e o percurso completo de ativação/revogação foram implementados na [Parte 2D](interface-pareamento-teste.md). As pendências abaixo descrevem o encerramento da Parte 2C.

21/09/2026. Implementação local em `functions/acesso-v2.js`, exportada por `functions/index.js`. Não publicada. O acesso legado permanece como antes.

## Fluxo implementado

1. Administrador autenticado, com custom claim administrativa confirmada novamente no cadastro do Auth, cria a loja e reserva seu slug público. A loja ganha ID aleatório independente de licença.
2. O gerente inicial deve ser um usuário existente no Auth, ativo e com e-mail verificado. O endpoint cria seu vínculo privado. Outro endpoint permite ao administrador vincular usuários verificados como gerente, caixa ou cozinha. Não cria senhas nem envia mensagens.
3. O terminal cria uma identidade anônima própria no Auth. Um gerente da mesma loja ou administrador autoriza esse UID para caixa ou cozinha. Não permite autorizar terminal como gerente nem converter usuário humano já cadastrado em terminal.
4. O servidor gera token aleatório de 256 bits, válido por dez minutos. Guarda somente SHA-256 no identificador do documento; o texto do token é retornado apenas na emissão.
5. O terminal autenticado entrega o token. Uma transação verifica destinatário, prazo, uso, loja ativa, autoridade atual do emissor e ausência de vínculo anterior; depois grava terminal, membro, consumo do token e auditoria juntos.
6. Se a resposta se perder depois da gravação, o terminal consulta seu próprio vínculo pelo UID autenticado. Não precisa reaplicar o token nem informar a loja. Campo UID enviado pelo cliente é ignorado nessa consulta.
7. Gerente da loja ou administrador pode revogar o terminal. O vínculo privado e o registro do terminal ficam inativos na mesma transação. Novas leituras protegidas são recusadas; isso não apaga informações previamente carregadas offline.

## Endpoints callable

| Função | Entrada principal | Quem usa |
|---|---|---|
| `adminCriarLojaV2` | nome, slug, gerenteUid | Administrador por claim confirmada no Auth |
| `adminCadastrarMembroV2` | lojaId, uid, papel | Administrador por claim confirmada no Auth |
| `emitirPareamentoV2` | lojaId, terminalUid, papel, nome | Gerente humano da loja ou administrador |
| `concluirPareamentoV2` | token | Somente o UID destinatário autenticado |
| `consultarMeuTerminalV2` | nenhum campo necessário | Consulta apenas o próprio UID autenticado |
| `revogarTerminalV2` | lojaId, terminalUid | Gerente humano da loja ou administrador |

Coleções privadas novas: `pareamentos_v2`, `terminais_v2` e `auditoria_acesso_v2`. Não há regra permitindo acesso direto do cliente a elas. Escritas são feitas pelo servidor após autorização explícita. Auditoria guarda ação, ator, alvo, loja e data, nunca o token em texto.

Uso de Admin SDK ignora as regras do Firestore; por isso a verificação de autorização no endpoint é obrigatória e foi exercitada pelos testes de chamadas reais.

## Testes e reprodução

Executar, a partir de `adega-pdv-gestao`:

```powershell
powershell -NoProfile -File scripts/test-pairing.ps1
```

O runner usa o Java e Firebase CLI locais da Parte 2B e fixa `demo-flowpdv`. Inicializa Auth, Firestore e Functions apenas localmente; encerra os processos ao concluir. Usar emuladores vazios, sem exportação de dados reais.

`test/pairing-v2.test.cjs` cria contas fictícias no Auth Emulator, faz login pelo SDK cliente e chama os endpoints HTTP callable do Functions Emulator. Não são apenas funções de autorização simuladas.

**Resultado final: 7/7 cenários passaram, zero falhas**, incluindo a consulta de recuperação adicionada ao fluxo. Os três emuladores foram encerrados ao final. As suítes das etapas anteriores não foram reexecutadas nesta entrega; seus resultados continuam sendo referências anteriores.

Sete cenários cobrem:

- Limite de administrador, unicidade de slug e exigência de usuário humano verificado.
- Gerente da outra loja, caixa e tentativa de elevar terminal a gerente.
- Hash do token, destinatário correto, uso único, recuperação do vínculo e revogação, incluindo consulta direta pelas regras de banco.
- Expiração sem criar vínculo.
- Duas requisições simultâneas com apenas uma conclusão bem-sucedida.
- Perda de gerência invalidando convite pendente.
- Retirada de claim administrativa impedindo nova chamada administrativa, mesmo usando token de login antigo.

Na primeira execução foi encontrado e corrigido um problema na importação de FieldValue no ambiente Functions. A implementação passou a usar os exports modulares `FieldValue` e `Timestamp` de `firebase-admin/firestore`.

Runtime local observado: Node 24, enquanto `functions/package.json` ainda declara Node 20. O emulador utilizou o Node do computador e avisou também sobre a versão antiga do firebase-functions. Não alteramos dependências ou runtime de produção nesta entrega. Antes de publicação, alinhar e testar o runtime de implantação suportado. Esta validação local não é homologação em nuvem.

## Limites e próxima entrega

- Os endpoints estão prontos para integração local; ainda não há telas de cadastro/pareamento conectadas no painel e PDV.
- Usuários humanos precisam existir no Auth com e-mail verificado; criação de conta, verificação e recuperação de senha ainda não fazem parte desta entrega.
- Configuração de autenticação anônima de produção, proteção contra abuso, limites de terminais por assinatura, expurgo de convites expirados e gestão completa de usuários/recuperação precisam ser definidos antes do uso comercial.
- A identidade do terminal é persistida pelo Auth; se esse armazenamento for apagado, será necessária uma nova identidade e uma nova autorização. Identidade já vinculada, mesmo revogada, não é reaproveitada automaticamente.
- A área V2 ainda não recebe pedidos do cardápio. O servidor público de pedidos e o acompanhamento sanitizado continuam pendentes.
- As credenciais antigas não foram revogadas, e a vulnerabilidade do fluxo legado ainda não foi eliminada. A migração precisa combinar as novas telas, autenticação do PDV, cardápio e regras, com compatibilidade e recuperação.

A próxima subetapa é conectar esse fluxo às interfaces de teste e verificar a ativação de um terminal do começo ao fim, mantendo o aplicativo normal no fluxo atual até a migração coordenada.
