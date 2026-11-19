# RedeZap: chat estilo WhatsApp com Sockets

Redes de Computadores, Atividade Avaliada 3 (Prof. Luciano V. Gonçalves, IFRS Campus Rio Grande)
Estudante: Francine Gonçalves Nunes Moraes

O RedeZap é feito em TypeScript com Node.js e usa só as bibliotecas de socket do próprio Node: `node:net` para o TCP e `node:dgram` para o UDP. Nenhuma biblioteca pronta de chat ou de rede foi usada.

| Conversa | Protocolo | Caminho |
|---|---|---|
| Privada (ponto a ponto) | **TCP** | cliente → cliente, direto, sem passar pelo servidor |
| Grupo (broadcast) | **UDP** | cliente → servidor → todos os outros clientes |
| Cadastro e lista de contatos | **TCP** | cliente ↔ servidor, na porta 9990 |

```
                   ┌────────────────────────────┐
                   │          SERVIDOR          │
                   │ TCP 9990: cadastro e lista │
                   │ UDP 9990: grupo            │
                   └────────────────────────────┘
                     ▲  TCP + UDP          ▲  TCP + UDP
                     ▼                     ▼
             ┌──────────────┐      ┌──────────────┐
             │   Cliente    │ TCP  │   Cliente    │
             │     Fran     │◄────►│     Ana      │
             └──────────────┘direto└──────────────┘
```

## Como rodar

O RedeZap precisa do **Node.js 22.18 ou mais novo** (o Node 24 LTS serve). Para conferir a versão, rode `node --version`. Não precisa rodar `npm install`, porque o Node executa os arquivos `.ts` direto.

Abra um terminal para o servidor e um terminal para cada cliente, todos na pasta do projeto.

```bash
node src/servidor.ts          # terminal 1
node src/cliente.ts Fran      # terminal 2
node src/cliente.ts Ana       # terminal 3
node src/cliente.ts Leo       # terminal 4
```

Se o servidor estiver em outra máquina da rede, passe o IP dele depois do nick:

```bash
node src/cliente.ts Fran 192.168.0.10
```

Na primeira vez, o Windows pode perguntar sobre o firewall. Clique em **Permitir acesso**.

## Comandos do cliente

| O que digitar | O que faz |
|---|---|
| `qualquer texto` | manda no **grupo** (UDP, passa pelo servidor) |
| `/pv Ana oi, tudo bem?` | manda uma mensagem **privada** para a Ana (TCP, direto) |
| `/lista` | pede a lista de contatos ao servidor (TCP) |
| `/ajuda` | mostra os comandos |
| `/sair` | sai do chat |

## Arquivos

| Arquivo | O que tem |
|---|---|
| `src/protocolo.ts` | os tipos de mensagem (JSON com o campo `tipo`), o envio e a recepção pelo TCP com `\n` no fim de cada mensagem, e as cores do terminal |
| `src/servidor.ts` | o TCP 9990, com cadastro, lista de contatos e os avisos de quem entrou e quem saiu, e o UDP 9990, que repassa as mensagens do grupo |
| `src/cliente.ts` | a porta própria do cliente (TCP e UDP), a conversa privada, o grupo e o cadastro no servidor |

## Mensagens do protocolo

Toda mensagem é um JSON com um campo `tipo`.

- **TCP com o servidor:**
  - `CADASTRO`
  - `BEM_VINDO`
  - `ERRO`
  - `PEDIR_LISTA`
  - `LISTA`
  - `ENTROU`
  - `SAIU`
- **TCP direto entre clientes:**
  - `OLA`
  - `PRIVADO`
- **UDP:**
  - `GRUPO`
  - `ENTREGUE` (o servidor avisa quem mandou para quantas pessoas repassou a mensagem)

## Opcional: conferir os tipos ou rodar em Node antigo

```bash
npm install         # instala só o TypeScript e os tipos do Node (ferramentas de desenvolvimento)
npm run verificar   # confere os tipos (tsc --noEmit)
npm run build       # gera JavaScript em dist/
node dist/servidor.js
node dist/cliente.js Fran
```
