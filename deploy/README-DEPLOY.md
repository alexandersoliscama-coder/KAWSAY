# KAWSAY · Despliegue en VPS (MVP)

Fase actual: interfaz (Astronaut / Medical staff) + motor NEWS2 + API SQL embebida + Monitor IA (Python + Ollama).
Todo en un solo VPS Linux. **No es un producto clínico**: datos sintéticos, motor en BORRADOR sin revisión clínica.

## Requisitos
- Ubuntu 22.04 o 24.04, acceso root/sudo, puerto 80 (y 443 si usas HTTPS) abierto.
- Sin IA (Monitor IA con reporte de respaldo): 2 vCPU / 2–4 GB RAM.
- Con IA (`qwen3:4b`): 4+ vCPU / 8 GB RAM y ~5 GB de disco. Sin GPU el reporte del LLM tarda decenas de segundos.

## Instalar
```bash
unzip KAWSAY-MVP-para-Bryan.zip && cd kawsay
sudo bash deploy/install.sh --domain tudominio.com --with-ollama   # sin dominio: omitir --domain
```
El script instala nginx, Node 24, Python, crea el usuario `kawsay`, compila, crea los servicios systemd
(`kawsay-demo` en 127.0.0.1:4180, `kawsay-monitor` en 127.0.0.1:8765) y configura nginx con **contraseña**.
Imprime el usuario/contraseña una sola vez. HTTPS: `sudo apt install certbot python3-certbot-nginx && sudo certbot --nginx -d tudominio.com`.

## Por qué nginx reescribe Host y Origin
El servidor rechaza (403) cualquier `Host` distinto de `127.0.0.1:4180` y los POST sin ese `Origin`. Escucha solo en loopback.
nginx lo reescribe (`deploy/nginx/kawsay.conf`). Si cambias el puerto, edita `contracts/local-demo.json` y el nginx.

## Seguridad (importante)
- La app **no tiene autenticación** y acepta escrituras (reportes de emergencia, muestras): no la expongas sin contraseña/VPN.
- Los puertos 4180, 8765 y 11434 deben quedar cerrados al exterior (solo nginx 80/443). `ufw allow 22,80,443/tcp && ufw enable`.
- "Médico" y "Astronauta" son un cambio de perfil en la misma interfaz; los reportes se guardan en el navegador de cada persona
  (localStorage). **No hay envío entre dispositivos**: el botón EMERGENCY no avisa a nadie. Es una limitación del MVP.

## Operación
```bash
systemctl status kawsay-demo kawsay-monitor        # estado
journalctl -u kawsay-monitor -f                     # logs del Monitor IA
sudo systemctl restart kawsay-demo kawsay-monitor   # reiniciar
```
Datos: `/opt/kawsay/app/data-kit/.demo-data` (PGlite) y `/opt/kawsay/app/llm-service/runtime/monitor.sqlite3`.
Actualizar: copiar el código nuevo y volver a ejecutar `deploy/install.sh` (conserva datos y contraseña).
Timeout del LLM: editar `--timeout` en `kawsay-monitor.service`.

## Sin verificar
`install.sh` y las unidades systemd/nginx no se han ejecutado en un VPS real (solo la app y sus cabeceras, en un entorno de pruebas).
Probar primero en una VM.
