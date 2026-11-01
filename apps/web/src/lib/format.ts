const nf = new Intl.NumberFormat('en-US');

export const money = (n: number, currency = 'EGP') => `${nf.format(Math.round(n))} ${currency === 'EGP' ? 'ج.م' : currency}`;

export const signedMoney = (n: number) => (n > 0 ? `+${money(n)}` : n < 0 ? `−${money(-n)}` : 'مشمول');
