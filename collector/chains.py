# Redes com catálogo público VTEX verificado em 23/10/2026
CHAINS = [
  # id, nome, base url (API), site público, UFs de atuação (p/ filtrar OSM), regex do nome no OSM
  dict(id="zaffari", name="Zaffari", base="https://www.zaffari.com.br", ufs=["RS","SP"], osm=r"^(Supermercado |Hipermercado |Bourbon )?Zaffari|^Bourbon", wb=["zaffari.com.br"]),
  dict(id="muffato", name="Super Muffato", base="https://www.supermuffato.com.br", ufs=["PR","SP"], osm=r"Muffato", wb=["supermuffato.com.br"]),
  dict(id="bistek", name="Bistek Supermercados", base="https://www.bistek.com.br", ufs=["SC","RS"], osm=r"Bistek", wb=["bistek.com.br"]),
  dict(id="giassi", name="Giassi Supermercados", base="https://www.giassi.com.br", ufs=["SC"], osm=r"Giassi", wb=["giassi.com.br"]),
  dict(id="zonasul", name="Zona Sul", base="https://www.zonasul.com.br", ufs=["RJ"], osm=r"^(Supermercado(s)? )?Zona Sul", wb=["zonasul.com.br","zonasulatende.com.br"]),
  dict(id="prezunic", name="Prezunic", base="https://www.prezunic.com.br", ufs=["RJ"], osm=r"Prezunic", wb=["prezunic.com.br"]),
  dict(id="oba", name="Oba Hortifruti", base="https://www.obahortifruti.com.br", ufs=["SP","DF","GO","RJ","PR","MG"], osm=r"^Oba( Hortifr| Horti|$)", wb=["obahortifruti.com.br"]),
  dict(id="covabra", name="Covabra Supermercados", base="https://www.covabra.com.br", ufs=["SP"], osm=r"Covabra", wb=["covabra.com.br"]),
  dict(id="savegnago", name="Savegnago", base="https://www.savegnago.com.br", ufs=["SP"], osm=r"Savegnago", wb=["savegnago.com.br"]),
  dict(id="mambo", name="Mambo Supermercados", base="https://www.mambo.com.br", ufs=["SP"], osm=r"Mambo", wb=["mambo.com.br"]),
  dict(id="supernosso", name="Super Nosso", base="https://www.supernosso.com", ufs=["MG"], osm=r"Super ?Nosso", wb=["supernosso.com","supernossoemcasa.com.br"]),
  dict(id="paguemenos", name="Super Pague Menos", base="https://www.superpaguemenos.com.br", ufs=["SP"], osm=r"Pague Menos", wb=["superpaguemenos.com.br"]),
  dict(id="mercantil", name="Mercantil Rodrigues / Atacado", base="https://www.mercantilatacado.com.br", ufs=["BA","SE","PE","AL"], osm=r"Mercantil( Rodrigues| Atacado)", wb=["mercantilatacado.com.br","mercantilrodrigues.com.br"]),
  dict(id="atacadao", name="Atacadão", base="https://www.atacadao.com.br/io", ufs=None, osm=r"^Atacad[aã]o( -.*| Loja.*| Autosservi.*| Curitiba.*| S[aã]o Jos[eé] dos Pinhais| Pirituba)?$", wb=["atacadao.com.br"]),
  dict(id="bretas", name="Bretas", base="https://www.bretas.com.br", ufs=["GO","DF"], osm=r"Bretas", wb=["bretas.com.br"]),
]
BY_ID = {c["id"]: c for c in CHAINS}
