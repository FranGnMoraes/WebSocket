// =====================================================================
// protocolo.ts — o "idioma" que o servidor e os clientes falam
// =====================================================================
// Toda mensagem é um objeto JSON com um campo "tipo".
// Isso é a "troca de mensagens estruturadas" pedida no trabalho.

import type { Socket } from 'node:net';

// Porta do servidor (pedida no enunciado). Usada no TCP e no UDP.
export const PORTA_SERVIDOR = 9990;

// Um contato da lista do servidor: nome, IP e porta do cliente.
export interface Contato {
  nick: string;
  ip: string;
  porta: number;
}

// ---------------------------------------------------------------------
// Mensagens que andam pelo TCP
// ---------------------------------------------------------------------
export type MensagemTcp =
  // cliente -> servidor: "quero entrar, meu nick é X e eu escuto na porta P"
  | { tipo: 'CADASTRO'; nick: string; porta: number }
  // servidor -> cliente: "entrou! aqui está a lista de contatos"
  | { tipo: 'BEM_VINDO'; contatos: Contato[] }
  // servidor -> cliente: "não deu" (ex.: nick repetido)
  | { tipo: 'ERRO'; texto: string }
  // cliente -> servidor: "me manda a lista de contatos"
  | { tipo: 'PEDIR_LISTA' }
  // servidor -> cliente: a lista de contatos
  | { tipo: 'LISTA'; contatos: Contato[] }
  // servidor -> todos: avisos para manter a lista sincronizada
  | { tipo: 'ENTROU'; contato: Contato }
  | { tipo: 'SAIU'; nick: string }
  // cliente -> cliente (conversa privada, SEM passar pelo servidor)
  | { tipo: 'OLA'; nick: string }
  | { tipo: 'PRIVADO'; de: string; texto: string; hora: string };

// ---------------------------------------------------------------------
// Mensagens que andam pelo UDP (o grupo)
// ---------------------------------------------------------------------
export type MensagemUdp =
  // cliente -> servidor -> todos: mensagem no grupo
  | { tipo: 'GRUPO'; de: string; texto: string; hora: string }
  // servidor -> quem mandou: "repassei para N pessoas"
  | { tipo: 'ENTREGUE'; quantos: number };

// ---------------------------------------------------------------------
// Enviar e receber pelo TCP
// ---------------------------------------------------------------------
// O TCP é um FLUXO de bytes: ele não separa uma mensagem da outra.
// Duas mensagens podem chegar grudadas, ou uma pode chegar pela metade.
// Por isso cada mensagem termina com "\n" (uma por linha).

export function enviarTcp(socket: Socket, msg: MensagemTcp): void {
  socket.write(JSON.stringify(msg) + '\n');
}

export function receberTcp(socket: Socket, tratar: (msg: MensagemTcp) => void): void {
  let guardado = ''; // o que chegou e ainda não formou uma linha inteira
  socket.setEncoding('utf8');

  socket.on('data', (pedaco: string) => {
    guardado += pedaco;
    let fimDaLinha = guardado.indexOf('\n');
    while (fimDaLinha >= 0) {
      const linha = guardado.slice(0, fimDaLinha);
      guardado = guardado.slice(fimDaLinha + 1);
      const msg = lerJson<MensagemTcp>(linha);
      if (msg) tratar(msg);
      fimDaLinha = guardado.indexOf('\n');
    }
  });
}

// O UDP já entrega cada datagrama inteiro e separado: não precisa do "\n".
export function lerJson<T>(texto: string): T | null {
  try {
    return JSON.parse(texto) as T;
  } catch {
    return null; // mensagem fora do protocolo: ignora
  }
}

// ---------------------------------------------------------------------
// Utilidades
// ---------------------------------------------------------------------
export function horaAgora(): string {
  return new Date().toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' });
}

// Em máquinas com IPv6 o IP aparece como "::ffff:127.0.0.1". Tira o prefixo.
export function limparIp(ip: string | undefined): string {
  return (ip ?? '').replace(/^::ffff:/, '');
}

// Cores no terminal (códigos ANSI, sem biblioteca)
export const cor = {
  cinza: (t: string) => `\x1b[90m${t}\x1b[0m`,
  verde: (t: string) => `\x1b[32m${t}\x1b[0m`,
  amarelo: (t: string) => `\x1b[33m${t}\x1b[0m`,
  azul: (t: string) => `\x1b[36m${t}\x1b[0m`,
  roxo: (t: string) => `\x1b[35m${t}\x1b[0m`,
  vermelho: (t: string) => `\x1b[31m${t}\x1b[0m`,
  negrito: (t: string) => `\x1b[1m${t}\x1b[0m`,
};
