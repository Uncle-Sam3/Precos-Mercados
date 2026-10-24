#!/usr/bin/env python3
"""Gera site/data/ncm_regras.json: regras categoria/nome -> NCM provável (ESTIMATIVA), só com códigos válidos
na nomenclatura oficial (Siscomex/Receita, download público) e presentes na tabela IBPT.
Uso: python tools/ncm_rules.py /tmp/ncm.json"""
import json, sys, re, os
SRC = sys.argv[1]
nom = json.load(open(SRC, encoding="utf-8-sig"))
DESC = {re.sub(r"\D", "", n["Codigo"]): re.sub(r"<[^>]+>", "", n["Descricao"]) for n in nom["Nomenclaturas"]}
VALID = {k for k in DESC if len(k) == 8}
IB = json.load(open(os.path.join(os.path.dirname(__file__), "..", "site/data/ibpt/SP.json")))["t"]
# (regex sobre "nome | categoria" normalizado sem acento, NCM provável). Ordem importa: o primeiro que casar vale.
R = [
 # higiene e beleza
 (r"\bshampoo|\bxampu", "33051000"), (r"condicionador|cremes? (de|para) (tratamento|pentear)|mascara capilar|finalizador|tratamento capilar|leave.?in|coloracao|tintura|tonalizante", "33059000"),
 (r"creme dental|gel dental|pasta de dente", "33061000"), (r"fio dental|fita dental", "33062000"), (r"enxaguante bucal|antisseptico bucal", "33069000"),
 (r"escova dental|escova de dente", "96032100"), (r"desodorante|antitranspirante", "33072010"),
 (r"sabonete liquido|sabonete intimo", "34013000"), (r"sabonete", "34011190"),
 (r"esmalte|base para unha", "33043000"), (r"protetor solar|hidratante|locao corporal|oleo corporal|maquiagem|batom|demaquilante|creme facial|creme para (as )?maos", "33049990"),
 (r"absorvente|protetor diario|fralda|lenco umedecido", "96190000"), (r"papel higienico", "48181000"), (r"papel toalha", "48182000"), (r"guardanapo", "48183000"),
 (r"aparelho de barbear|lamina de barbear|barbeador", "82121020"), (r"algodao|haste flexivel|cotonete", "56012190"),
 # limpeza
 (r"amaciante", "38099190"), (r"sabao em barra", "34011900"), (r"lava.?roupa|sabao (em po|liquido)|tira.?manchas|alvejante sem cloro", "34025000"),
 (r"agua sanitaria|alvejante", "28289011"), (r"desinfetante|bactericida", "38089419"), (r"inseticida|repelente|raticida", "38089199"),
 (r"detergente|lava.?loucas|limpador|multiuso|limpa vidro|desengordurante|saponaceo|limpeza pesada", "34025000"),
 (r"odorizador|aromatizador|desodorizador", "33074900"), (r"saco(s)? (de|para) lixo", "39232190"), (r"esponja|palha de aco|lã de aço|la de aco", "73239100"),
 (r"cera (liquida|para piso)|lustra moveis", "34059000"), (r"alcool (liquido|gel|70|46)", "22071090"), (r"vela", "34060000"),
 # bebidas
 (r"agua tonica", "22021000"), (r"\bmel\b", "04090000"), (r"adocante", "21069090"), (r"charque|carne seca|jerked", "02102000"), (r"aparelho (para|de) barbear|depilat", "82121020"),
 (r"refrigerante|\bguarana\b.*(lata|pet|ml|l\b)|\bcola\b.*(lata|pet|2l|350ml)", "22021000"),
 (r"agua (mineral|sem gas|com gas|gaseificada)|\bagua\b.*\b(500ml|1,5l|1.5l|5l|copo)", "22011000"),
 (r"agua de coco", "20098990"), (r"energetico|isotonico|cha pronto|bebida (de|a base de) soja|bebida vegetal|ice tea|refresco pronto", "22029900"),
 (r"suco integral|suco natural|nectar|suco (de|pronto)|suco\b", "20098990"), (r"refresco em po|suco em po", "21069010"),
 (r"cerveja|chopp", "22030000"), (r"espumante|champagne|prosecco|frisante", "22041010"), (r"\bvinho|\bvinto\b", "22042100"),
 (r"whisky|whiskey|uisque", "22083020"), (r"vodka", "22086000"), (r"\bgin\b", "22085000"), (r"cachaca|aguardente|caninha", "22084000"),
 (r"\brum\b", "22084000"), (r"licor|aperitivo|vermute|tequila|conhaque|destilado|drink pronto|drinks prontos|ice\b", "22087000"),
 # mercearia
 (r"oleo de soja", "15079011"), (r"azeite", "15092000"), (r"oleo de girassol", "15121911"), (r"oleo de canola", "15141910"), (r"oleo de milho", "15152910"),
 (r"\barroz\b(?!.*(biscoito|bolacha|snack|salgadinho|torrada|farinha|leite|bebida|shampoo|sabonete|cereal))", "10063021"),
 (r"\bfeijao\b(?!.*(salgadinho|snack))", "07133319"), (r"lentilha", "07134090"), (r"grao.?de.?bico", "07132090"),
 (r"acucar", "17019900"), (r"\bsal\b(?!.*(biscoito|bolacha|salgad|amendoim|batata|manteiga))", "25010020"),
 (r"cafe soluvel|cappuccino", "21011110"), (r"\bcafe\b|capsula(s)? de cafe", "09012100"),
 (r"achocolatado", "18069000"), (r"chocolate em po|cacau em po", "18061000"), (r"barra de chocolate|chocolate em barra|tablete", "18063210"),
 (r"bombom|ovo de pascoa|chocolate|confeito|trufa", "18069000"),
 (r"chiclete|goma de mascar", "17041000"), (r"\bbala\b|\bbalas\b|pirulito|jujuba|pastilha|marshmallow|paçoca|pacoca|pe de moleque|doce de amendoim", "17049020"),
 (r"leite condensado", "04029900"), (r"creme de leite", "04015010"), (r"leite em po", "04022110"), (r"composto lacteo", "19019020"),
 (r"bebida lactea|leite fermentado", "04039000"), (r"iogurte|\bgrego\b", "04032000"),
 (r"\bleite\b(?!.*(biscoito|chocolate|bolacha|sabonete|hidratante|coco))", "04012010"),
 (r"manteiga", "04051000"), (r"margarina|creme vegetal", "15171000"), (r"requeijao|cream cheese", "04061090"),
 (r"mussarela|muçarela|mozarela|muzzarela", "04061010"), (r"queijo ralado", "04062000"), (r"\bqueijo", "04069090"),
 (r"\bovos?\b(?!.*(pascoa|chocolate))", "04072100"),
 (r"macarrao instantaneo|lamen|miojo", "19023000"), (r"lasanha|nhoque|ravioli|capeletti|massa fresca|massas frescas", "19022000"),
 (r"macarrao|espaguete|penne|parafuso|talharim|massa seca|massas? grano duro|massa (para|de) ", "19021900"),
 (r"biscoito salgado|cream cracker|agua e sal|\bsalgado\b.*biscoito|bolacha salgada|crackers?", "19059020"),
 (r"wafer|waffer", "19053200"), (r"biscoito|bolacha|cookie|rosquinha|amanteigado", "19053100"),
 (r"torrada", "19054000"), (r"pao de forma|pao integral|pao de hot ?dog|pao de hamburguer|bisnaguinha|pao\b", "19059010"),
 (r"panetone|chocotone|bolo|pao de mel|bolinho|muffin|brownie", "19059090"),
 (r"batata palha|batata chips|batata frita|batata (sabor|ondulada)", "20052000"),
 (r"salgadinho|snack|pipoca pronta|chips|extrusado|torcida", "19041000"),
 (r"milho (de|para) pipoca|pipoca", "10059010"), (r"amendoim", "20081100"), (r"castanha|nozes|amendoa|pistache|mix de nuts", "08013200"),
 (r"granola|cereal matinal|sucrilhos|flocos de milho|cereal\b", "19042000"), (r"barra de cereal|barra de proteina|barrinha", "19042000"),
 (r"aveia", "11041200"), (r"farinha de trigo", "11010010"), (r"farinha de mandioca|farofa|tapioca|goma", "11062000"),
 (r"fuba|flocao|farinha de milho|canjica|milho de canjica", "11022000"), (r"amido de milho|maisena|polvilho|fecula", "11081200"),
 (r"mistura para bolo|mistura de bolo|massa para bolo|fermento|pudim|mousse|sobremesa em po|gelatina", "21069029"),
 (r"molho de tomate|extrato de tomate|polpa de tomate|ketchup|catchup", "21032010"), (r"maionese", "21039011"), (r"mostarda", "21033021"),
 (r"shoyu|molho de soja", "21031010"), (r"caldo (de|em)|tablete de caldo", "21041011"), (r"sopa|creme de (cebola|legumes|ervilha)", "21041021"),
 (r"vinagre", "22090000"), (r"molho|tempero|condimento|chimichurri", "21039021"),
 (r"oregano|ervas finas|pimenta do reino|canela|cominho|colorau|paprica|curry|cravo|noz.?moscada|especiaria|louro", "09109900"),
 (r"milho (verde|em conserva)|seleta de legumes", "20058000"), (r"ervilha", "20054000"), (r"azeitona", "20057000"), (r"palmito", "20089100"),
 (r"atum", "16041410"), (r"sardinha", "16041310"), (r"conserva|enlatado|pepino|champignon|cogumelo", "20019000"),
 (r"geleia|doce de fruta|goiabada|marmelada|compota", "20079990"), (r"doce de leite", "19019020"), (r"leite de coco|coco ralado", "21069090"),
 (r"sorvete|picole|gelato", "21050010"), (r"acai", "20089900"), (r"polpa de fruta|polpa\b", "08119000"),
 (r"\bcha\b|cha (verde|preto|mate|de camomila|de erva)|erva.?mate|chimarrao", "09023000"),
 (r"alimento infantil|papinha|formula infantil|leite infantil|cereal infantil|mucilon|farinha lactea", "19011010"),
 (r"whey|suplemento|proteina|creatina|colageno|bebida proteica|complemento alimentar", "21061000"),
 (r"racao|petisco para (caes|gatos)|areia (para|higienica) gato|sache para (caes|gatos)", "23091000"),
 # carnes, frios, congelados
 (r"empanado|nuggets?", "16023220"), (r"hamburguer", "16025000"), (r"pizza|pao de queijo|salgado congelado|prato pronto|refeicao congelada|lasanha congelada", "19059090"),
 (r"linguica|salsicha|salame|calabresa", "16010000"), (r"presunto|apresuntado|mortadela|peito de peru|blanquet|copa\b|lombo defumado", "16024900"),
 (r"bacon|toucinho", "02101200"), (r"bacalhau", "03056900"), (r"camarao", "03061719"), (r"\bfile de (tilapia|merluza|salmao|pescada)|salmao|tilapia|peixe|merluza|pescada", "03048900"),
 (r"frango|coxa|sobrecoxa|peito de frango|asa de frango|\bave\b|galinha|chester|peru\b", "02071400"),
 (r"suin|lombo|pernil|costela suina|bisteca", "02032900"), (r"bovin|carne|picanha|alcatra|contra.?file|patinho|acem|musculo|cupim|maminha|fraldinha|costela|carne moida|file mignon", "02013000"),
 # hortifruti
 (r"banana", "08039000"), (r"\bmaca\b|maçã", "08081000"), (r"laranja|tangerina|mexerica|limao", "08051000"), (r"uva\b", "08061000"),
 (r"mamao|melao|melancia|abacaxi|manga\b|morango|kiwi|pera\b|abacate|goiaba|maracuja|caqui|fruta", "08109000"),
 (r"tomate", "07020000"), (r"batata", "07019000"), (r"cebola", "07031019"), (r"alho\b", "07032090"), (r"alface|rucula|agriao|couve|espinafre|repolho", "07051100"),
 (r"cenoura|beterraba|mandioca|aipim|inhame|abobora|abobrinha|pepino|pimentao|chuchu|berinjela|quiabo|vagem|legume|verdura|hortalica|cheiro.?verde|salsa\b|coentro", "07099990"),
 # bazar
 (r"chinelo|sandalia", "64022000"), (r"pneu", "40111000"), (r"brinquedo|boneca|pelucia|carrinho de brinquedo", "95030099"), (r"caderno|agenda", "48202000"),
 (r"lampada", "85395200"), (r"pilha|bateria alcalina", "85061019"), (r"panela|frigideira|caçarola", "73239300"), (r"copo|taca|caneca", "70133700"),
 (r"talher|garfo|faca|colher", "82159910"), (r"pote|tigela|jarra|vasilha|marmita", "39241000"), (r"papel aluminio|filme pvc|plastico filme", "76071990"),
]
out, fixed = [], []
def best(code):
    if code in VALID and code in IB: return code
    for pref in (code[:6], code[:4]):
        c = sorted(k for k in VALID if k.startswith(pref) and k in IB)
        if c: fixed.append((code, c[0])); return c[0]
    raise SystemExit(f"sem código válido para {code}")
for rx, code in R:
    re.compile(rx); c = best(code)
    cl = lambda t: t.strip().lstrip("-– ").strip().rstrip(":").strip()
    parts = [x for x in dict.fromkeys(cl(DESC.get(c[:n], "")) for n in (4, 5, 6, 7, 8)) if x and x.lower() not in ("outros", "outras")]
    parts = [(x[:57].rsplit(" ", 1)[0] + "…") if len(x) > 60 else x for x in parts]
    out.append({"re": rx, "ncm": c, "d": " › ".join(parts)})
json.dump({"fonte_nomenclatura": f"Receita Federal/Siscomex — {nom['Data_Ultima_Atualizacao_NCM']} ({nom['Ato']})", "regras": out},
          open(os.path.join(os.path.dirname(__file__), "..", "site/data/ncm_regras.json"), "w"), ensure_ascii=False, separators=(",", ":"))
print(len(out), "regras;", "substituídos:", fixed)
