const http = require('http');
const https = require('https');

// Aapka fixed verified Blink Lightning Address
const MY_LIGHTNING_ADDRESS = "securepayments@blink.sv"; 

const server = http.createServer((req, res) => {
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

    if (req.method === 'OPTIONS') {
        res.writeHead(200);
        res.end();
        return;
    }

    const urlParams = new URL(req.url, `http://${req.headers.host}`);
    
    if (urlParams.pathname === '/fetch-route') {
        let amountInDollars = urlParams.searchParams.get('amount');
        if (!amountInDollars || amountInDollars <= 0) {
            res.writeHead(400, { 'Content-Type': 'application/json' });
            res.end(JSON.stringify({ error: "Invalid amount" }));
            return;
        }

        https.get("https://api.coingecko.com/api/v3/simple/price?ids=bitcoin&vs_currencies=usd", (priceRes) => {
            let data = '';
            priceRes.on('data', chunk => data += chunk);
            priceRes.on('end', () => {
                try {
                    let btcPrice = JSON.parse(data).bitcoin.usd;
                    let amountInSats = Math.round((amountInDollars / btcPrice) * 100000000);
                    let amountInMilliSats = amountInSats * 1000;

                    let [user, domain] = MY_LIGHTNING_ADDRESS.split('@');
                    https.get(`https://${domain}/.well-known/lnurlp/${user.toLowerCase()}`, (lnurlRes) => {
                        let lnurlData = '';
                        lnurlRes.on('data', chunk => lnurlData += chunk);
                        lnurlRes.on('end', () => {
                            try {
                                let callbackUrl = JSON.parse(lnurlData).callback;
                                
                                https.get(`${callbackUrl}?amount=${amountInMilliSats}`, (invoiceRes) => {
                                    let invoiceData = '';
                                    invoiceRes.on('data', chunk => invoiceData += chunk);
                                    invoiceRes.on('end', () => {
                                        try {
                                            let pr = JSON.parse(invoiceData).pr;
                                            res.writeHead(200, { 'Content-Type': 'application/json' });
                                            res.end(JSON.stringify({ success: true, redirect_url: "lightning:" + pr }));
                                        } catch (e) { fallbackRouting(res); }
                                    });
                                }).on('error', () => fallbackRouting(res));
                            } catch (e) { fallbackRouting(res); }
                        });
                    }).on('error', () => fallbackRouting(res));
                } catch (e) { fallbackRouting(res); }
            });
        }).on('error', () => fallbackRouting(res));
    } else {
        res.writeHead(404);
        res.end();
    }
});

function fallbackRouting(res) {
    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ success: true, redirect_url: "lightning:" + MY_LIGHTNING_ADDRESS.toLowerCase() }));
}

const PORT = process.env.PORT || 3000;
server.listen(PORT, () => console.log(`Upay Pro Server Running on port ${PORT}`));
