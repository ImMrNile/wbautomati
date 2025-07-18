const token = process.env.WB_API_TOKEN;
if (!token) {
    console.error('WB_API_TOKEN environment variable not set');
    process.exit(1);
}

const userAgents = [
    'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36',
    'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.4 Safari/605.1.15',
    'Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/123.0.0.0 Safari/537.36',
    'Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.0 Mobile/15E148 Safari/604.1'
];

const cardData = [{
    vendorCode: `AI-TEST-${Date.now()}`,
    title: 'Тестовый товар',
    description: 'Описание тестового товара',
    brand: 'NoName',
    imtId: 14727,
    characteristics: [
        { id: 14863, value: 'красный' },
        { id: 7174, value: 'хлопок' }
    ]
}];

const response = await fetch('https://suppliers-api.wildberries.ru/content/v2/cards/upload', {
    method: 'POST',
    headers: {
        'Authorization': token,
        'Content-Type': 'application/json',
        'User-Agent': userAgents[Math.floor(Math.random() * userAgents.length)]
    },
    body: JSON.stringify(cardData)
});

console.log('Status:', response.status);
try {
    const data = await response.json();
    console.log('Response:', data);
} catch (err) {
    console.error('Failed to parse response:', err);
}