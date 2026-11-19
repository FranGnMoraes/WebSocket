// =====================================================================
// protocolo.ts — o "idioma" que o servidor e os clientes falam
// =====================================================================
// Toda mensagem é um objeto JSON com um campo "tipo".
// Isso é a "troca de mensagens estruturadas" pedida no trabalho.
// Porta do servidor (pedida no enunciado). Usada no TCP e no UDP.
export const PORTA_SERVIDOR = 9990;
// ---------------------------------------------------------------------
// Enviar e receber pelo TCP
// ---------------------------------------------------------------------
// O TCP é um FLUXO de bytes: ele não separa uma mensagem da outra.
// Duas mensagens podem chegar grudadas, ou uma pode chegar pela metade.
// Por isso cada mensagem termina com "\n" (uma por linha).
export function enviarTcp(socket, msg) {
    socket.write(JSON.stringify(msg) + '\n');
}
export function receberTcp(socket, tratar) {
    let guardado = ''; // o que chegou e ainda não formou uma linha inteira
    socket.setEncoding('utf8');
    socket.on('data', (pedaco) => {
        guardado += pedaco;
        let fimDaLinha = guardado.indexOf('\n');
        while (fimDaLinha >= 0) {
            const linha = guardado.slice(0, fimDaLinha);
            guardado = guardado.slice(fimDaLinha + 1);
            const msg = lerJson(linha);
            if (msg)
                tratar(msg);
            fimDaLinha = guardado.indexOf('\n');
        }
    });
}
// O UDP já entrega cada datagrama inteiro e separado: não precisa do "\n".
export function lerJson(texto) {
    try {
        return JSON.parse(texto);
    }
    catch {
        return null; // mensagem fora do protocolo: ignora
    }
}
// ---------------------------------------------------------------------
// Utilidades
// ---------------------------------------------------------------------
export function horaAgora() {
    return new Date().toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' });
}
// Em máquinas com IPv6 o IP aparece como "::ffff:127.0.0.1". Tira o prefixo.
export function limparIp(ip) {
    return (ip ?? '').replace(/^::ffff:/, '');
}
// Cores no terminal (códigos ANSI, sem biblioteca)
export const cor = {
    cinza: (t) => `\x1b[90m${t}\x1b[0m`,
    verde: (t) => `\x1b[32m${t}\x1b[0m`,
    amarelo: (t) => `\x1b[33m${t}\x1b[0m`,
    azul: (t) => `\x1b[36m${t}\x1b[0m`,
    roxo: (t) => `\x1b[35m${t}\x1b[0m`,
    vermelho: (t) => `\x1b[31m${t}\x1b[0m`,
    negrito: (t) => `\x1b[1m${t}\x1b[0m`,
};
