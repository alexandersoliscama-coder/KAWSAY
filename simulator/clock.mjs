export function medidoEn(inicioISO, day, hour) {
  const ms = Date.parse(inicioISO) + (day * 24 + hour) * 3600 * 1000;
  return new Date(ms).toISOString();
}

export function estadoEn(medidoISO) {
  return new Date(Date.parse(medidoISO) + 1000).toISOString();
}