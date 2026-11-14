import json
with open("C:/Users/alexa/Downloads/KAWSAY-historial/app/public/data/vitals.json", encoding="utf-8") as f:
    registros = json.load(f)

print("Total de registros:", len(registros))

dias = []
for r in registros:
    dias.append(r["day"])

print("Día mínimo:", min(dias))
print("Día máximo:", max(dias))
conteo = {}
for r in registros:
    astro = r["astro"]
    conteo[astro] = conteo.get(astro, 0) + 1

print("Registros por astronauta:", conteo)
campos = ["hr", "rr", "spo2", "sbp", "temp"]

for campo in campos:
    faltantes = 0
    for r in registros:
        if r.get(campo) is None:
            faltantes = faltantes + 1
    print(campo, "faltantes:", faltantes)