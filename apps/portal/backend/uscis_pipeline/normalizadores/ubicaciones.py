"""Normalizadores: ubicaciones (estados, países, ZIP)."""

ESTADOS_US = {'alabama':'AL','alaska':'AK','arizona':'AZ','arkansas':'AR','california':'CA','colorado':'CO','connecticut':'CT','delaware':'DE','florida':'FL','georgia':'GA','hawaii':'HI','idaho':'ID','illinois':'IL','indiana':'IN','iowa':'IA','kansas':'KS','kentucky':'KY','louisiana':'LA','maine':'ME','maryland':'MD','massachusetts':'MA','michigan':'MI','minnesota':'MN','mississippi':'MS','missouri':'MO','montana':'MT','nebraska':'NE','nevada':'NV','new hampshire':'NH','new jersey':'NJ','new mexico':'NM','new york':'NY','north carolina':'NC','north dakota':'ND','ohio':'OH','oklahoma':'OK','oregon':'OR','pennsylvania':'PA','rhode island':'RI','south carolina':'SC','south dakota':'SD','tennessee':'TN','texas':'TX','utah':'UT','vermont':'VT','virginia':'VA','washington':'WA','west virginia':'WV','wisconsin':'WI','wyoming':'WY','district of columbia':'DC','puerto rico':'PR'}

PAISES = {'venezuela':'VENEZUELA','colombia':'COLOMBIA','mexico':'MEXICO','méxico':'MEXICO','ecuador':'ECUADOR','argentina':'ARGENTINA','peru':'PERU','perú':'PERU','chile':'CHILE','brasil':'BRAZIL','brazil':'BRAZIL','estados unidos':'THE UNITED STATES OF AMERICA','eeuu':'THE UNITED STATES OF AMERICA','usa':'THE UNITED STATES OF AMERICA','united states':'THE UNITED STATES OF AMERICA','canada':'CANADA','canadá':'CANADA','españa':'SPAIN','spain':'SPAIN'}

def normalizar_estado(valor: str) -> str:
    if not valor: return ""
    v = valor.strip()
    if len(v) == 2 and v.upper() in ESTADOS_US.values(): return v.upper()
    return ESTADOS_US.get(v.lower(), v.upper())

def normalizar_pais(valor: str) -> str:
    if not valor: return ""
    return PAISES.get(valor.strip().lower(), valor.strip().upper())

def normalizar_zip(valor: str) -> str:
    return valor.strip()[:10] if valor else ""
