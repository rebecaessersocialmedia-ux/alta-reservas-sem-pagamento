# Pagamento online · InfinitePay + aviso no WhatsApp

## 1. InfinitePay
App InfinitePay → Vendas → Checkout → Configurações → **Habilitar Checkout Integrado**.

## 2. CallMeBot (aviso automático no WhatsApp)
1. No celular que vai RECEBER os avisos (+55 34 99162-9171), salve o contato do CallMeBot
   (número atual em https://www.callmebot.com/blog/free-api-whatsapp-messages/).
2. Envie para ele a mensagem: `I allow callmebot to send me messages`
3. Ele responde com sua **apikey**.

## 3. Planilha
Cole o novo `alta-reservas.gs` no Apps Script → Salvar → Executar **configurar** →
Implantar → Gerenciar implantações → Editar (lápis) → Versão: **Nova versão** → Implantar.
(A URL /exec continua a mesma.)

## 4. Vercel → Settings → Environment Variables
| Nome | Valor |
|---|---|
| INFINITEPAY_HANDLE | alta-sushi |
| SHEETS_URL | https://script.google.com/macros/s/AKfycbzbs-ptz67RZKDB_y7ZbgVsz2PldK1IWLBRribhdm5GSa87hARVEgxAp0pGt7rk02wS/exec |
| SHEETS_SECRET | alta-1w2x475o6s455g53 |
| CALLMEBOT_PHONE | 5534991629171 |
| CALLMEBOT_APIKEY | (a apikey recebida do CallMeBot) |

Depois: suba a pasta `site` inteira no GitHub (index.html, assets, api, package.json) →
Vercel → Deployments → **Redeploy**.

## Teste
Faça uma reserva de 1 pessoa (R$ 50) com Pix. Deve acontecer:
- volta ao site com "Reserva confirmada";
- planilha: linha com Status **Pago**, canal "Site · InfinitePay" e link do comprovante;
- mensagem "✅ RESERVA PAGA" no WhatsApp.
