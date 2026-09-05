import ExcelJS from 'exceljs';
import fs from 'fs';
import path from 'path';

// Catálogo completo e realista para Adega / Distribuidora de Bebidas
const produtosAdega = [
  // =========================================================================
  // 1. CERVEJAS (Com Fardos e Packs configurados)
  // =========================================================================
  {
    ean: '7891991000819',
    categoria: 'Cervejas',
    nome: 'Cerveja Brahma Chopp Lata 350ml',
    custo: 2.75,
    venda: 3.99,
    estoque: 144,
    minimo: 24,
    fardoNome: 'Fardo c/ 12',
    fardoQtd: 12,
    fardoPreco: 44.90,
    fardoEan: '7891991000826'
  },
  {
    ean: '7891991010856',
    categoria: 'Cervejas',
    nome: 'Cerveja Brahma Duplo Malte Lata 350ml',
    custo: 3.10,
    venda: 4.49,
    estoque: 120,
    minimo: 24,
    fardoNome: 'Fardo c/ 12',
    fardoQtd: 12,
    fardoPreco: 49.90,
    fardoEan: '7891991010863'
  },
  {
    ean: '7891991001342',
    categoria: 'Cervejas',
    nome: 'Cerveja Skol Pilsen Lata 350ml',
    custo: 2.65,
    venda: 3.89,
    estoque: 144,
    minimo: 24,
    fardoNome: 'Fardo c/ 12',
    fardoQtd: 12,
    fardoPreco: 42.90,
    fardoEan: '7891991001359'
  },
  {
    ean: '7896045501860',
    categoria: 'Cervejas',
    nome: 'Cerveja Amstel Lager Lata 350ml',
    custo: 2.95,
    venda: 4.29,
    estoque: 96,
    minimo: 24,
    fardoNome: 'Fardo c/ 12',
    fardoQtd: 12,
    fardoPreco: 46.90,
    fardoEan: '7896045501877'
  },
  {
    ean: '7896045505615',
    categoria: 'Cervejas',
    nome: 'Cerveja Heineken Lata 350ml',
    custo: 4.50,
    venda: 6.49,
    estoque: 144,
    minimo: 24,
    fardoNome: 'Fardo c/ 12',
    fardoQtd: 12,
    fardoPreco: 72.90,
    fardoEan: '7896045505622'
  },
  {
    ean: '7896045504786',
    categoria: 'Cervejas',
    nome: 'Cerveja Heineken Long Neck 330ml',
    custo: 5.40,
    venda: 7.99,
    estoque: 72,
    minimo: 18,
    fardoNome: 'Pack c/ 6',
    fardoQtd: 6,
    fardoPreco: 44.90,
    fardoEan: '7896045504793'
  },
  {
    ean: '7891991002349',
    categoria: 'Cervejas',
    nome: 'Cerveja Budweiser Lata 350ml',
    custo: 3.25,
    venda: 4.69,
    estoque: 120,
    minimo: 24,
    fardoNome: 'Fardo c/ 12',
    fardoQtd: 12,
    fardoPreco: 52.90,
    fardoEan: '7891991002356'
  },
  {
    ean: '7891991002301',
    categoria: 'Cervejas',
    nome: 'Cerveja Budweiser Long Neck 330ml',
    custo: 4.50,
    venda: 6.99,
    estoque: 48,
    minimo: 12,
    fardoNome: 'Pack c/ 6',
    fardoQtd: 6,
    fardoPreco: 38.90,
    fardoEan: '7891991002318'
  },
  {
    ean: '7891991003452',
    categoria: 'Cervejas',
    nome: 'Cerveja Corona Extra Long Neck 330ml',
    custo: 5.60,
    venda: 8.49,
    estoque: 60,
    minimo: 18,
    fardoNome: 'Pack c/ 6',
    fardoQtd: 6,
    fardoPreco: 48.90,
    fardoEan: '7891991003469'
  },
  {
    ean: '7891991004121',
    categoria: 'Cervejas',
    nome: 'Cerveja Stella Artois Long Neck 330ml',
    custo: 5.10,
    venda: 7.49,
    estoque: 60,
    minimo: 18,
    fardoNome: 'Pack c/ 6',
    fardoQtd: 6,
    fardoPreco: 42.90,
    fardoEan: '7891991004138'
  },
  {
    ean: '7891991005111',
    categoria: 'Cervejas',
    nome: 'Cerveja Stella Artois Pure Gold Lata 350ml',
    custo: 3.60,
    venda: 5.29,
    estoque: 72,
    minimo: 18,
    fardoNome: 'Fardo c/ 12',
    fardoQtd: 12,
    fardoPreco: 59.90,
    fardoEan: '7891991005128'
  },
  {
    ean: '7896045502119',
    categoria: 'Cervejas',
    nome: 'Cerveja Eisenbahn Pilsen Long Neck 355ml',
    custo: 4.60,
    venda: 6.99,
    estoque: 48,
    minimo: 12,
    fardoNome: 'Pack c/ 6',
    fardoQtd: 6,
    fardoPreco: 39.90,
    fardoEan: '7896045502126'
  },
  {
    ean: '7891991006125',
    categoria: 'Cervejas',
    nome: 'Cerveja Spaten Puro Malte Lata 350ml',
    custo: 3.35,
    venda: 4.79,
    estoque: 120,
    minimo: 24,
    fardoNome: 'Fardo c/ 12',
    fardoQtd: 12,
    fardoPreco: 54.90,
    fardoEan: '7891991006132'
  },
  {
    ean: '7891991006149',
    categoria: 'Cervejas',
    nome: 'Cerveja Spaten Long Neck 355ml',
    custo: 4.80,
    venda: 7.29,
    estoque: 48,
    minimo: 12,
    fardoNome: 'Pack c/ 6',
    fardoQtd: 6,
    fardoPreco: 41.90,
    fardoEan: '7891991006156'
  },
  {
    ean: '7891991007818',
    categoria: 'Cervejas',
    nome: 'Cerveja Original Antarctica Lata 350ml',
    custo: 3.40,
    venda: 4.89,
    estoque: 96,
    minimo: 24,
    fardoNome: 'Fardo c/ 12',
    fardoQtd: 12,
    fardoPreco: 55.90,
    fardoEan: '7891991007825'
  },
  {
    ean: '7896045503413',
    categoria: 'Cervejas',
    nome: 'Cerveja Devassa Tropical Puro Malte Lata 350ml',
    custo: 2.55,
    venda: 3.69,
    estoque: 96,
    minimo: 24,
    fardoNome: 'Fardo c/ 12',
    fardoQtd: 12,
    fardoPreco: 39.90,
    fardoEan: '7896045503420'
  },
  {
    ean: '7896045504113',
    categoria: 'Cervejas',
    nome: 'Cerveja Sol Premium Long Neck 330ml',
    custo: 4.60,
    venda: 6.99,
    estoque: 36,
    minimo: 12,
    fardoNome: 'Pack c/ 6',
    fardoQtd: 6,
    fardoPreco: 38.90,
    fardoEan: '7896045504120'
  },
  {
    ean: '7891991008129',
    categoria: 'Cervejas',
    nome: 'Cerveja Brahma 0.0% Álcool Long Neck 330ml',
    custo: 4.20,
    venda: 6.49,
    estoque: 24,
    minimo: 6,
    fardoNome: 'Pack c/ 6',
    fardoQtd: 6,
    fardoPreco: 36.90,
    fardoEan: '7891991008136'
  },
  {
    ean: '7896045505127',
    categoria: 'Cervejas',
    nome: 'Cerveja Heineken 0.0% Álcool Long Neck 330ml',
    custo: 5.60,
    venda: 8.29,
    estoque: 36,
    minimo: 6,
    fardoNome: 'Pack c/ 6',
    fardoQtd: 6,
    fardoPreco: 46.90,
    fardoEan: '7896045505134'
  },
  {
    ean: '7891991009126',
    categoria: 'Cervejas',
    nome: 'Cerveja Colorado Ribeirão Lager Garrafa 600ml',
    custo: 8.90,
    venda: 13.90,
    estoque: 24,
    minimo: 6
  },
  {
    ean: '7891991009157',
    categoria: 'Cervejas',
    nome: 'Cerveja Colorado Appia Mel Garrafa 600ml',
    custo: 9.90,
    venda: 14.90,
    estoque: 24,
    minimo: 6
  },

  // =========================================================================
  // 2. DESTILADOS (Whiskies, Vodkas, Gins, Cachaças, Licores, Tequilas)
  // =========================================================================
  {
    ean: '5000267014203',
    categoria: 'Destilados',
    nome: 'Whisky Johnnie Walker Red Label 1L',
    custo: 72.00,
    venda: 99.90,
    estoque: 18,
    minimo: 4
  },
  {
    ean: '5000267024202',
    categoria: 'Destilados',
    nome: 'Whisky Johnnie Walker Black Label 12 Anos 1L',
    custo: 125.00,
    venda: 169.90,
    estoque: 12,
    minimo: 3
  },
  {
    ean: '5000299211021',
    categoria: 'Destilados',
    nome: 'Whisky White Horse 1L',
    custo: 54.00,
    venda: 74.90,
    estoque: 20,
    minimo: 5
  },
  {
    ean: '5010106113127',
    categoria: 'Destilados',
    nome: 'Whisky Ballantines Finest 1L',
    custo: 58.00,
    venda: 79.90,
    estoque: 16,
    minimo: 4
  },
  {
    ean: '5010106114124',
    categoria: 'Destilados',
    nome: 'Whisky Chivas Regal 12 Anos 1L',
    custo: 118.00,
    venda: 159.90,
    estoque: 10,
    minimo: 2
  },
  {
    ean: '082184090466',
    categoria: 'Destilados',
    nome: 'Whisky Jack Daniels Old No 7 1L',
    custo: 112.00,
    venda: 149.90,
    estoque: 18,
    minimo: 4
  },
  {
    ean: '082184000458',
    categoria: 'Destilados',
    nome: 'Whiskey Jack Daniels Honey (Mel) 1L',
    custo: 118.00,
    venda: 159.90,
    estoque: 14,
    minimo: 3
  },
  {
    ean: '082184000496',
    categoria: 'Destilados',
    nome: 'Whiskey Jack Daniels Fire (Canela) 1L',
    custo: 118.00,
    venda: 159.90,
    estoque: 12,
    minimo: 3
  },
  {
    ean: '5010496001000',
    categoria: 'Destilados',
    nome: 'Whisky Passport Scotch 1L',
    custo: 38.00,
    venda: 54.90,
    estoque: 24,
    minimo: 6
  },
  {
    ean: '7891008000104',
    categoria: 'Destilados',
    nome: 'Whisky Natu Nobilis 1L',
    custo: 28.00,
    venda: 39.90,
    estoque: 20,
    minimo: 5
  },
  {
    ean: '7891008001101',
    categoria: 'Destilados',
    nome: 'Vodka Smirnoff Red 21 998ml',
    custo: 29.00,
    venda: 42.90,
    estoque: 24,
    minimo: 6
  },
  {
    ean: '7312040017059',
    categoria: 'Destilados',
    nome: 'Vodka Absolut Regular 1L',
    custo: 75.00,
    venda: 104.90,
    estoque: 12,
    minimo: 3
  },
  {
    ean: '7891008002108',
    categoria: 'Destilados',
    nome: 'Vodka Orloff 1L',
    custo: 21.00,
    venda: 31.90,
    estoque: 20,
    minimo: 5
  },
  {
    ean: '7891008003105',
    categoria: 'Destilados',
    nome: 'Vodka Askov Sabores 900ml (Frutas Vermelhas)',
    custo: 9.50,
    venda: 14.90,
    estoque: 30,
    minimo: 6
  },
  {
    ean: '5000281005409',
    categoria: 'Destilados',
    nome: 'Gin Tanqueray London Dry 750ml',
    custo: 82.00,
    venda: 119.90,
    estoque: 15,
    minimo: 3
  },
  {
    ean: '5000281062006',
    categoria: 'Destilados',
    nome: 'Gin Tanqueray Sevilla 700ml',
    custo: 98.00,
    venda: 139.90,
    estoque: 8,
    minimo: 2
  },
  {
    ean: '5010103917100',
    categoria: 'Destilados',
    nome: 'Gin Beefeater London Dry 750ml',
    custo: 74.00,
    venda: 104.90,
    estoque: 10,
    minimo: 2
  },
  {
    ean: '5010103939102',
    categoria: 'Destilados',
    nome: 'Gin Beefeater Pink Morango 750ml',
    custo: 82.00,
    venda: 114.90,
    estoque: 10,
    minimo: 2
  },
  {
    ean: '5000299601006',
    categoria: 'Destilados',
    nome: 'Gin Gordons London Dry 750ml',
    custo: 46.00,
    venda: 67.90,
    estoque: 16,
    minimo: 4
  },
  {
    ean: '7891008004102',
    categoria: 'Destilados',
    nome: 'Gin Rocks Strawberry 995ml',
    custo: 24.00,
    venda: 36.90,
    estoque: 18,
    minimo: 4
  },
  {
    ean: '7891121000104',
    categoria: 'Destilados',
    nome: 'Cachaça 51 Pirassununga 965ml',
    custo: 9.80,
    venda: 14.90,
    estoque: 30,
    minimo: 6
  },
  {
    ean: '7891121001101',
    categoria: 'Destilados',
    nome: 'Cachaça Velho Barreiro Tradicional 910ml',
    custo: 10.50,
    venda: 15.90,
    estoque: 24,
    minimo: 6
  },
  {
    ean: '7896004000106',
    categoria: 'Destilados',
    nome: 'Cachaça Sagatiba Pura 700ml',
    custo: 26.00,
    venda: 38.90,
    estoque: 12,
    minimo: 3
  },
  {
    ean: '7896004001103',
    categoria: 'Destilados',
    nome: 'Cachaça Seleta Ouro Salinas 1L',
    custo: 38.00,
    venda: 54.90,
    estoque: 10,
    minimo: 2
  },
  {
    ean: '7896004002100',
    categoria: 'Destilados',
    nome: 'Cachaça Cabaré Ouro Envelhecida 700ml',
    custo: 36.00,
    venda: 52.90,
    estoque: 8,
    minimo: 2
  },
  {
    ean: '7501005011002',
    categoria: 'Destilados',
    nome: 'Tequila Jose Cuervo Ouro Especial 750ml',
    custo: 88.00,
    venda: 124.90,
    estoque: 8,
    minimo: 2
  },
  {
    ean: '7501005021001',
    categoria: 'Destilados',
    nome: 'Tequila Jose Cuervo Prata Silver 750ml',
    custo: 88.00,
    venda: 124.90,
    estoque: 8,
    minimo: 2
  },
  {
    ean: '7611700600109',
    categoria: 'Destilados',
    nome: 'Licor Jägermeister 700ml',
    custo: 92.00,
    venda: 129.90,
    estoque: 10,
    minimo: 2
  },
  {
    ean: '5011013100156',
    categoria: 'Destilados',
    nome: 'Licor Baileys Irish Cream 750ml',
    custo: 82.00,
    venda: 114.90,
    estoque: 8,
    minimo: 2
  },
  {
    ean: '6001108000010',
    categoria: 'Destilados',
    nome: 'Licor Amarula Cream 750ml',
    custo: 78.00,
    venda: 109.90,
    estoque: 8,
    minimo: 2
  },
  {
    ean: '7891008005109',
    categoria: 'Destilados',
    nome: 'Campari Bitter 900ml',
    custo: 42.00,
    venda: 59.90,
    estoque: 16,
    minimo: 4
  },
  {
    ean: '7891008006106',
    categoria: 'Destilados',
    nome: 'Aperol Aperitivo Italiano 750ml',
    custo: 48.00,
    venda: 68.90,
    estoque: 12,
    minimo: 3
  },

  // =========================================================================
  // 3. VINHOS & ESPUMANTES
  // =========================================================================
  {
    ean: '7896006700011',
    categoria: 'Vinhos',
    nome: 'Vinho Pérgola Tinto Suave 1L',
    custo: 18.50,
    venda: 26.90,
    estoque: 36,
    minimo: 8
  },
  {
    ean: '7896006700028',
    categoria: 'Vinhos',
    nome: 'Vinho Pérgola Tinto Seco 1L',
    custo: 18.50,
    venda: 26.90,
    estoque: 24,
    minimo: 6
  },
  {
    ean: '7896006700103',
    categoria: 'Vinhos',
    nome: 'Vinho Quinta do Morgado Tinto Suave 750ml',
    custo: 11.50,
    venda: 17.90,
    estoque: 30,
    minimo: 6
  },
  {
    ean: '7896006700202',
    categoria: 'Vinhos',
    nome: 'Vinho Sangue de Boi Tinto Suave 750ml',
    custo: 12.00,
    venda: 18.90,
    estoque: 24,
    minimo: 6
  },
  {
    ean: '7804300100104',
    categoria: 'Vinhos',
    nome: 'Vinho Chileno Casillero del Diablo Cabernet Sauvignon 750ml',
    custo: 38.00,
    venda: 54.90,
    estoque: 18,
    minimo: 4
  },
  {
    ean: '7804300100203',
    categoria: 'Vinhos',
    nome: 'Vinho Chileno Casillero del Diablo Carmenere 750ml',
    custo: 38.00,
    venda: 54.90,
    estoque: 14,
    minimo: 3
  },
  {
    ean: '7804320100301',
    categoria: 'Vinhos',
    nome: 'Vinho Chileno Reservado Concha y Toro Cabernet Sauvignon 750ml',
    custo: 24.00,
    venda: 36.90,
    estoque: 24,
    minimo: 6
  },
  {
    ean: '7804320100400',
    categoria: 'Vinhos',
    nome: 'Vinho Chileno Reservado Concha y Toro Sweet Red Suave 750ml',
    custo: 24.00,
    venda: 36.90,
    estoque: 24,
    minimo: 6
  },
  {
    ean: '7804340100108',
    categoria: 'Vinhos',
    nome: 'Vinho Chileno Gato Negro Cabernet Sauvignon 750ml',
    custo: 26.00,
    venda: 39.90,
    estoque: 16,
    minimo: 4
  },
  {
    ean: '7896006700509',
    categoria: 'Vinhos',
    nome: 'Espumante Chandon Réserve Brut 750ml',
    custo: 72.00,
    venda: 99.90,
    estoque: 12,
    minimo: 2
  },
  {
    ean: '7896006700516',
    categoria: 'Vinhos',
    nome: 'Espumante Chandon Passion Rosé Demi-Sec 750ml',
    custo: 76.00,
    venda: 104.90,
    estoque: 10,
    minimo: 2
  },
  {
    ean: '7896006700608',
    categoria: 'Vinhos',
    nome: 'Espumante Salton Moscatel 750ml',
    custo: 28.00,
    venda: 41.90,
    estoque: 20,
    minimo: 4
  },
  {
    ean: '7896006700615',
    categoria: 'Vinhos',
    nome: 'Espumante Salton Brut 750ml',
    custo: 28.00,
    venda: 41.90,
    estoque: 16,
    minimo: 4
  },

  // =========================================================================
  // 4. NÃO ALCOÓLICOS (Energéticos, Refrigerantes, Águas, Sucos, Isotônicos)
  // =========================================================================
  {
    ean: '9002490100070',
    categoria: 'Não Alcoólicos',
    nome: 'Energético Red Bull Energy Drink 250ml',
    custo: 6.20,
    venda: 9.49,
    estoque: 96,
    minimo: 24,
    fardoNome: 'Pack c/ 4',
    fardoQtd: 4,
    fardoPreco: 35.90,
    fardoEan: '9002490100087'
  },
  {
    ean: '9002490200077',
    categoria: 'Não Alcoólicos',
    nome: 'Energético Red Bull Sugarfree Sem Açúcar 250ml',
    custo: 6.20,
    venda: 9.49,
    estoque: 48,
    minimo: 12,
    fardoNome: 'Pack c/ 4',
    fardoQtd: 4,
    fardoPreco: 35.90,
    fardoEan: '9002490200084'
  },
  {
    ean: '9002490300074',
    categoria: 'Não Alcoólicos',
    nome: 'Energético Red Bull Tropical Edition 250ml',
    custo: 6.30,
    venda: 9.49,
    estoque: 48,
    minimo: 12,
    fardoNome: 'Pack c/ 4',
    fardoQtd: 4,
    fardoPreco: 35.90,
    fardoEan: '9002490300081'
  },
  {
    ean: '9002490400071',
    categoria: 'Não Alcoólicos',
    nome: 'Energético Red Bull Melancia Red Edition 250ml',
    custo: 6.30,
    venda: 9.49,
    estoque: 48,
    minimo: 12,
    fardoNome: 'Pack c/ 4',
    fardoQtd: 4,
    fardoPreco: 35.90,
    fardoEan: '9002490400088'
  },
  {
    ean: '070847012482',
    categoria: 'Não Alcoólicos',
    nome: 'Energético Monster Energy Tradicional Lata 473ml',
    custo: 6.90,
    venda: 10.49,
    estoque: 72,
    minimo: 18,
    fardoNome: 'Pack c/ 6',
    fardoQtd: 6,
    fardoPreco: 58.90,
    fardoEan: '070847012489'
  },
  {
    ean: '070847022481',
    categoria: 'Não Alcoólicos',
    nome: 'Energético Monster Ultra White Sem Açúcar 473ml',
    custo: 6.90,
    venda: 10.49,
    estoque: 48,
    minimo: 12,
    fardoNome: 'Pack c/ 6',
    fardoQtd: 6,
    fardoPreco: 58.90,
    fardoEan: '070847022488'
  },
  {
    ean: '070847032480',
    categoria: 'Não Alcoólicos',
    nome: 'Energético Monster Mango Loco 473ml',
    custo: 6.90,
    venda: 10.49,
    estoque: 48,
    minimo: 12,
    fardoNome: 'Pack c/ 6',
    fardoQtd: 6,
    fardoPreco: 58.90,
    fardoEan: '070847032487'
  },
  {
    ean: '7898925430018',
    categoria: 'Não Alcoólicos',
    nome: 'Energético Baly Energy Drink 2L Tradicional (PET)',
    custo: 8.50,
    venda: 14.90,
    estoque: 40,
    minimo: 10,
    fardoNome: 'Fardo c/ 6',
    fardoQtd: 6,
    fardoPreco: 79.90,
    fardoEan: '7898925430025'
  },
  {
    ean: '7898925430117',
    categoria: 'Não Alcoólicos',
    nome: 'Energético Baly Tropical Frutas 2L (PET)',
    custo: 8.50,
    venda: 14.90,
    estoque: 36,
    minimo: 10,
    fardoNome: 'Fardo c/ 6',
    fardoQtd: 6,
    fardoPreco: 79.90,
    fardoEan: '7898925430124'
  },
  {
    ean: '7898925430216',
    categoria: 'Não Alcoólicos',
    nome: 'Energético Baly Melancia 2L (PET)',
    custo: 8.50,
    venda: 14.90,
    estoque: 36,
    minimo: 10,
    fardoNome: 'Fardo c/ 6',
    fardoQtd: 6,
    fardoPreco: 79.90,
    fardoEan: '7898925430223'
  },
  {
    ean: '7894900010015',
    categoria: 'Não Alcoólicos',
    nome: 'Refrigerante Coca-Cola Original Lata 350ml',
    custo: 2.70,
    venda: 3.99,
    estoque: 120,
    minimo: 24,
    fardoNome: 'Fardo c/ 12',
    fardoQtd: 12,
    fardoPreco: 44.90,
    fardoEan: '7894900010022'
  },
  {
    ean: '7894900011517',
    categoria: 'Não Alcoólicos',
    nome: 'Refrigerante Coca-Cola Sem Açúcar Lata 350ml',
    custo: 2.70,
    venda: 3.99,
    estoque: 72,
    minimo: 24,
    fardoNome: 'Fardo c/ 12',
    fardoQtd: 12,
    fardoPreco: 44.90,
    fardoEan: '7894900011524'
  },
  {
    ean: '7894900010152',
    categoria: 'Não Alcoólicos',
    nome: 'Refrigerante Coca-Cola Original 2L (PET)',
    custo: 7.60,
    venda: 10.99,
    estoque: 60,
    minimo: 12,
    fardoNome: 'Fardo c/ 6',
    fardoQtd: 6,
    fardoPreco: 59.90,
    fardoEan: '7894900010169'
  },
  {
    ean: '7894900011609',
    categoria: 'Não Alcoólicos',
    nome: 'Refrigerante Coca-Cola Sem Açúcar 2L (PET)',
    custo: 7.60,
    venda: 10.99,
    estoque: 36,
    minimo: 12,
    fardoNome: 'Fardo c/ 6',
    fardoQtd: 6,
    fardoPreco: 59.90,
    fardoEan: '7894900011616'
  },
  {
    ean: '7891991000215',
    categoria: 'Não Alcoólicos',
    nome: 'Refrigerante Guaraná Antarctica Lata 350ml',
    custo: 2.45,
    venda: 3.69,
    estoque: 96,
    minimo: 24,
    fardoNome: 'Fardo c/ 12',
    fardoQtd: 12,
    fardoPreco: 41.90,
    fardoEan: '7891991000222'
  },
  {
    ean: '7891991000307',
    categoria: 'Não Alcoólicos',
    nome: 'Refrigerante Guaraná Antarctica 2L (PET)',
    custo: 6.20,
    venda: 8.99,
    estoque: 48,
    minimo: 12,
    fardoNome: 'Fardo c/ 6',
    fardoQtd: 6,
    fardoPreco: 49.90,
    fardoEan: '7891991000314'
  },
  {
    ean: '7894900020014',
    categoria: 'Não Alcoólicos',
    nome: 'Refrigerante Fanta Laranja Lata 350ml',
    custo: 2.50,
    venda: 3.79,
    estoque: 48,
    minimo: 12,
    fardoNome: 'Fardo c/ 12',
    fardoQtd: 12,
    fardoPreco: 42.90,
    fardoEan: '7894900020021'
  },
  {
    ean: '7894900030013',
    categoria: 'Não Alcoólicos',
    nome: 'Refrigerante Sprite Lemon Fresh Lata 350ml',
    custo: 2.50,
    venda: 3.79,
    estoque: 36,
    minimo: 12,
    fardoNome: 'Fardo c/ 12',
    fardoQtd: 12,
    fardoPreco: 42.90,
    fardoEan: '7894900030020'
  },
  {
    ean: '7894900050011',
    categoria: 'Não Alcoólicos',
    nome: 'Água Tônica Schweppes Lata 350ml',
    custo: 2.80,
    venda: 4.29,
    estoque: 60,
    minimo: 12,
    fardoNome: 'Fardo c/ 12',
    fardoQtd: 12,
    fardoPreco: 47.90,
    fardoEan: '7894900050028'
  },
  {
    ean: '7894900060010',
    categoria: 'Não Alcoólicos',
    nome: 'Água Tônica Schweppes Citrus Lata 350ml',
    custo: 2.80,
    venda: 4.29,
    estoque: 48,
    minimo: 12,
    fardoNome: 'Fardo c/ 12',
    fardoQtd: 12,
    fardoPreco: 47.90,
    fardoEan: '7894900060027'
  },
  {
    ean: '7896045506018',
    categoria: 'Não Alcoólicos',
    nome: 'Água Mineral Crystal Sem Gás 500ml',
    custo: 1.10,
    venda: 2.49,
    estoque: 120,
    minimo: 24,
    fardoNome: 'Fardo c/ 12',
    fardoQtd: 12,
    fardoPreco: 21.90,
    fardoEan: '7896045506025'
  },
  {
    ean: '7896045506117',
    categoria: 'Não Alcoólicos',
    nome: 'Água Mineral Crystal Com Gás 500ml',
    custo: 1.25,
    venda: 2.79,
    estoque: 72,
    minimo: 18,
    fardoNome: 'Fardo c/ 12',
    fardoQtd: 12,
    fardoPreco: 24.90,
    fardoEan: '7896045506124'
  },
  {
    ean: '7896045506216',
    categoria: 'Não Alcoólicos',
    nome: 'Água Mineral Minalba Sem Gás 1.5L',
    custo: 2.10,
    venda: 3.99,
    estoque: 48,
    minimo: 12,
    fardoNome: 'Fardo c/ 6',
    fardoQtd: 6,
    fardoPreco: 21.90,
    fardoEan: '7896045506223'
  },
  {
    ean: '7891008007103',
    categoria: 'Não Alcoólicos',
    nome: 'Água de Coco Kero Coco 1L',
    custo: 7.50,
    venda: 11.90,
    estoque: 24,
    minimo: 6
  },
  {
    ean: '7891008008100',
    categoria: 'Não Alcoólicos',
    nome: 'Suco Del Valle Uva 1L',
    custo: 5.20,
    venda: 7.99,
    estoque: 30,
    minimo: 6
  },
  {
    ean: '7891008009107',
    categoria: 'Não Alcoólicos',
    nome: 'Isotônico Gatorade Frutas Cítricas 500ml',
    custo: 4.30,
    venda: 6.49,
    estoque: 36,
    minimo: 6
  },

  // =========================================================================
  // 5. GELO & CARVÃO
  // =========================================================================
  {
    ean: '7898900010015',
    categoria: 'Gelo & Carvão',
    nome: 'Saco de Gelo em Cubos Filtrado 5kg',
    custo: 5.00,
    venda: 10.00,
    estoque: 50,
    minimo: 15
  },
  {
    ean: '7898900010022',
    categoria: 'Gelo & Carvão',
    nome: 'Saco de Gelo em Cubos Filtrado 10kg',
    custo: 8.50,
    venda: 16.00,
    estoque: 30,
    minimo: 10
  },
  {
    ean: '7898900010114',
    categoria: 'Gelo & Carvão',
    nome: 'Gelo Saborizado de Coco para Drink 200ml (Copo)',
    custo: 1.80,
    venda: 4.00,
    estoque: 60,
    minimo: 20
  },
  {
    ean: '7898900010213',
    categoria: 'Gelo & Carvão',
    nome: 'Gelo Saborizado de Maracujá para Drink 200ml',
    custo: 1.80,
    venda: 4.00,
    estoque: 40,
    minimo: 15
  },
  {
    ean: '7898900010312',
    categoria: 'Gelo & Carvão',
    nome: 'Gelo Saborizado de Melancia para Drink 200ml',
    custo: 1.80,
    venda: 4.00,
    estoque: 40,
    minimo: 15
  },
  {
    ean: '7898900010411',
    categoria: 'Gelo & Carvão',
    nome: 'Gelo Saborizado de Maçã Verde para Drink 200ml',
    custo: 1.80,
    venda: 4.00,
    estoque: 40,
    minimo: 15
  },
  {
    ean: '7898900020014',
    categoria: 'Gelo & Carvão',
    nome: 'Saco de Carvão Vegetal Especial 2.5kg',
    custo: 8.00,
    venda: 14.90,
    estoque: 40,
    minimo: 10
  },
  {
    ean: '7898900020021',
    categoria: 'Gelo & Carvão',
    nome: 'Saco de Carvão Vegetal Especial 4kg',
    custo: 12.00,
    venda: 21.90,
    estoque: 25,
    minimo: 8
  },
  {
    ean: '7898900020113',
    categoria: 'Gelo & Carvão',
    nome: 'Acendedor de Churrasqueira em Gel / Pastilha',
    custo: 3.50,
    venda: 7.90,
    estoque: 30,
    minimo: 6
  },
  {
    ean: '7898900020212',
    categoria: 'Gelo & Carvão',
    nome: 'Sal Grosso para Churrasco Tradicional 1kg',
    custo: 2.20,
    venda: 4.90,
    estoque: 24,
    minimo: 6
  },

  // =========================================================================
  // 6. TABACARIA (Cigarros, Palheiros, Sedas, Isqueiros, Narguile, Pods)
  // =========================================================================
  {
    ean: '7891048010019',
    categoria: 'Tabacaria',
    nome: 'Cigarro Marlboro Red Box',
    custo: 10.50,
    venda: 13.00,
    estoque: 50,
    minimo: 10
  },
  {
    ean: '7891048010026',
    categoria: 'Tabacaria',
    nome: 'Cigarro Marlboro Gold Box',
    custo: 10.50,
    venda: 13.00,
    estoque: 40,
    minimo: 10
  },
  {
    ean: '7891048010033',
    categoria: 'Tabacaria',
    nome: 'Cigarro Chesterfield Blue Box',
    custo: 6.50,
    venda: 8.50,
    estoque: 40,
    minimo: 10
  },
  {
    ean: '7891048010040',
    categoria: 'Tabacaria',
    nome: 'Cigarro Dunhill Carlton Blend Box',
    custo: 11.00,
    venda: 14.00,
    estoque: 30,
    minimo: 8
  },
  {
    ean: '7898901000015',
    categoria: 'Tabacaria',
    nome: 'Palheiro Paulistinha Tradicional Maço',
    custo: 12.00,
    venda: 18.00,
    estoque: 30,
    minimo: 6
  },
  {
    ean: '7898901000114',
    categoria: 'Tabacaria',
    nome: 'Palheiro Piracanjuba Ouro com Filtro Maço',
    custo: 14.00,
    venda: 22.00,
    estoque: 25,
    minimo: 5
  },
  {
    ean: '3086121000019',
    categoria: 'Tabacaria',
    nome: 'Seda Smoking King Size Brown (Marrom)',
    custo: 3.50,
    venda: 7.00,
    estoque: 60,
    minimo: 15
  },
  {
    ean: '3086121000026',
    categoria: 'Tabacaria',
    nome: 'Seda Smoking King Size Deluxe (Preta)',
    custo: 3.50,
    venda: 7.00,
    estoque: 50,
    minimo: 15
  },
  {
    ean: '7898901000213',
    categoria: 'Tabacaria',
    nome: 'Seda Zomo King Size Slim Natural',
    custo: 2.50,
    venda: 5.00,
    estoque: 60,
    minimo: 15
  },
  {
    ean: '3086121000101',
    categoria: 'Tabacaria',
    nome: 'Filtro Smoking Regular 6mm Extra Longo',
    custo: 4.50,
    venda: 9.00,
    estoque: 30,
    minimo: 8
  },
  {
    ean: '070330600018',
    categoria: 'Tabacaria',
    nome: 'Isqueiro BIC Maxi Tradicional',
    custo: 4.20,
    venda: 7.50,
    estoque: 50,
    minimo: 15
  },
  {
    ean: '8412765000018',
    categoria: 'Tabacaria',
    nome: 'Isqueiro Clipper Recarregável Estampado',
    custo: 5.50,
    venda: 10.00,
    estoque: 40,
    minimo: 10
  },
  {
    ean: '7898901000312',
    categoria: 'Tabacaria',
    nome: 'Essência Narguile Zomo Strong Mint 50g',
    custo: 6.50,
    venda: 12.00,
    estoque: 40,
    minimo: 10
  },
  {
    ean: '7898901000329',
    categoria: 'Tabacaria',
    nome: 'Essência Narguile Zomo Blue Mix 50g',
    custo: 6.50,
    venda: 12.00,
    estoque: 30,
    minimo: 8
  },
  {
    ean: '7898901000411',
    categoria: 'Tabacaria',
    nome: 'Carvão de Coco para Narguile Hexagonal 1kg',
    custo: 22.00,
    venda: 35.00,
    estoque: 20,
    minimo: 5
  },
  {
    ean: '7898901000510',
    categoria: 'Tabacaria',
    nome: 'Alumínio para Narguile Predator 50 Folhas',
    custo: 7.00,
    venda: 14.00,
    estoque: 25,
    minimo: 6
  },
  {
    ean: '7898901000619',
    categoria: 'Tabacaria',
    nome: 'Pod Descartável Ignite V50 5000 Puffs (Menta Ice)',
    custo: 55.00,
    venda: 89.90,
    estoque: 15,
    minimo: 3
  },
  {
    ean: '7898901000626',
    categoria: 'Tabacaria',
    nome: 'Pod Descartável Ignite V50 5000 Puffs (Uva Ice)',
    custo: 55.00,
    venda: 89.90,
    estoque: 15,
    minimo: 3
  },

  // =========================================================================
  // 7. PETISCOS (Salgadinhos, Amendoins, Castanhas, Frios)
  // =========================================================================
  {
    ean: '7892840222148',
    categoria: 'Petiscos',
    nome: 'Salgadinho Doritos Queijo Nacho 140g',
    custo: 6.50,
    venda: 10.99,
    estoque: 36,
    minimo: 8
  },
  {
    ean: '7892840223145',
    categoria: 'Petiscos',
    nome: 'Batata Ruffles Tradicional Sal 140g',
    custo: 6.80,
    venda: 11.49,
    estoque: 30,
    minimo: 8
  },
  {
    ean: '7892840224142',
    categoria: 'Petiscos',
    nome: 'Batata Ruffles Queijo 140g',
    custo: 6.80,
    venda: 11.49,
    estoque: 24,
    minimo: 6
  },
  {
    ean: '038000138416',
    categoria: 'Petiscos',
    nome: 'Batata Pringles Original 114g (Tubo)',
    custo: 8.50,
    venda: 13.90,
    estoque: 24,
    minimo: 6
  },
  {
    ean: '038000138423',
    categoria: 'Petiscos',
    nome: 'Batata Pringles Creme e Cebola 114g (Tubo)',
    custo: 8.50,
    venda: 13.90,
    estoque: 24,
    minimo: 6
  },
  {
    ean: '7892840225149',
    categoria: 'Petiscos',
    nome: 'Salgadinho Torcida Queijo 70g',
    custo: 1.80,
    venda: 3.49,
    estoque: 48,
    minimo: 12
  },
  {
    ean: '7892840226146',
    categoria: 'Petiscos',
    nome: 'Salgadinho Torcida Bacon 70g',
    custo: 1.80,
    venda: 3.49,
    estoque: 48,
    minimo: 12
  },
  {
    ean: '7892840227143',
    categoria: 'Petiscos',
    nome: 'Salgadinho Torcida Pimenta Mexicana 70g',
    custo: 1.80,
    venda: 3.49,
    estoque: 36,
    minimo: 10
  },
  {
    ean: '7896004400104',
    categoria: 'Petiscos',
    nome: 'Amendoim Crocante Dori Tradicional 120g',
    custo: 2.60,
    venda: 4.99,
    estoque: 40,
    minimo: 10
  },
  {
    ean: '7896004400203',
    categoria: 'Petiscos',
    nome: 'Amendoim Japonês Dori 120g',
    custo: 2.60,
    venda: 4.99,
    estoque: 36,
    minimo: 10
  },
  {
    ean: '7896004400302',
    categoria: 'Petiscos',
    nome: 'Amendoim Sem Pele Salgado Santa Helena 150g',
    custo: 3.50,
    venda: 6.49,
    estoque: 30,
    minimo: 8
  },
  {
    ean: '7898902000014',
    categoria: 'Petiscos',
    nome: 'Castanha de Caju Torrada e Salgada 100g',
    custo: 7.00,
    venda: 12.90,
    estoque: 20,
    minimo: 5
  },
  {
    ean: '7898902000113',
    categoria: 'Petiscos',
    nome: 'Salaminho Italiano Fatiado e Embalado 100g',
    custo: 6.50,
    venda: 11.90,
    estoque: 20,
    minimo: 5
  },
  {
    ean: '7898902000212',
    categoria: 'Petiscos',
    nome: 'Azeitona Verde sem Caroço Sachê 150g',
    custo: 3.80,
    venda: 6.90,
    estoque: 24,
    minimo: 6
  },
  {
    ean: '7898902000311',
    categoria: 'Petiscos',
    nome: 'Queijo Provolone Desidratado Crocante 80g',
    custo: 6.90,
    venda: 12.50,
    estoque: 18,
    minimo: 4
  },

  // =========================================================================
  // 8. ACESSÓRIOS (Copos, Taças, Baldes, Abridores, Térmicos)
  // =========================================================================
  {
    ean: '7898903000013',
    categoria: 'Acessórios',
    nome: 'Copo Descartável Transparente 500ml (Tira c/ 50 un)',
    custo: 6.00,
    venda: 11.90,
    estoque: 30,
    minimo: 6
  },
  {
    ean: '7898903000112',
    categoria: 'Acessórios',
    nome: 'Copo Red Cup Americano Rígido 400ml (Pacote c/ 10 un)',
    custo: 8.50,
    venda: 15.90,
    estoque: 25,
    minimo: 5
  },
  {
    ean: '7898903000211',
    categoria: 'Acessórios',
    nome: 'Taça de Gin Acrílico Degradê 580ml (Unidade)',
    custo: 5.50,
    venda: 12.00,
    estoque: 30,
    minimo: 6
  },
  {
    ean: '7898903000310',
    categoria: 'Acessórios',
    nome: 'Copo Térmico de Inox com Tampa 473ml (Tipo Stanley)',
    custo: 24.00,
    venda: 45.00,
    estoque: 15,
    minimo: 3
  },
  {
    ean: '7898903000419',
    categoria: 'Acessórios',
    nome: 'Balde de Gelo em Alumínio 5 Litros Personalizado',
    custo: 18.00,
    venda: 34.90,
    estoque: 12,
    minimo: 2
  },
  {
    ean: '7898903000518',
    categoria: 'Acessórios',
    nome: 'Abridor de Garrafa Inox Portátil Chaveiro',
    custo: 2.00,
    venda: 5.00,
    estoque: 40,
    minimo: 10
  },
  {
    ean: '7898903000617',
    categoria: 'Acessórios',
    nome: 'Saca-Rolhas Profissional 2 Estágios para Vinho',
    custo: 8.00,
    venda: 18.90,
    estoque: 15,
    minimo: 3
  },
  {
    ean: '7898903000716',
    categoria: 'Acessórios',
    nome: 'Canudo de Papel Biodegradável (Pacote c/ 50 un)',
    custo: 3.50,
    venda: 7.90,
    estoque: 20,
    minimo: 4
  },
  {
    ean: '7898903000815',
    categoria: 'Acessórios',
    nome: 'Guardanapo de Papel Folha Dupla (Pacote c/ 50)',
    custo: 1.80,
    venda: 3.90,
    estoque: 30,
    minimo: 6
  },

  // =========================================================================
  // 9. COMBOS (Kits Prontos de Bebidas montados na Adega)
  // =========================================================================
  {
    ean: '7898904000012',
    categoria: 'Combos',
    nome: 'Combo Red Label (1L) + 4 Red Bull Tropical + 1 Saco de Gelo 5kg',
    custo: 105.00,
    venda: 149.90,
    estoque: 15,
    minimo: 2
  },
  {
    ean: '7898904000111',
    categoria: 'Combos',
    nome: 'Combo Jack Daniels 1L + 4 Coca-Cola Lata 350ml + Copos',
    custo: 125.00,
    venda: 174.90,
    estoque: 12,
    minimo: 2
  },
  {
    ean: '7898904000210',
    categoria: 'Combos',
    nome: 'Combo Gin Tanqueray 750ml + 4 Tônicas Schweppes + 1 Taça de Gin',
    custo: 100.00,
    venda: 144.90,
    estoque: 12,
    minimo: 2
  },
  {
    ean: '7898904000319',
    categoria: 'Combos',
    nome: 'Combo Vodka Smirnoff 1L + Energético Baly Tropical 2L + 2 Gelo de Coco',
    custo: 42.00,
    venda: 64.90,
    estoque: 20,
    minimo: 3
  },
  {
    ean: '7898904000418',
    categoria: 'Combos',
    nome: 'Combo Gin Rocks 995ml + Energético Baly Melancia 2L + Gelo Sabor',
    custo: 35.00,
    venda: 54.90,
    estoque: 20,
    minimo: 3
  },
  {
    ean: '7898904000517',
    categoria: 'Combos',
    nome: 'Combo Churrasco: 1 Carvão 4kg + 1 Sal Grosso + 1 Gelo 5kg + Acendedor',
    custo: 24.00,
    venda: 39.90,
    estoque: 15,
    minimo: 3
  },
  {
    ean: '7898904000616',
    categoria: 'Combos',
    nome: 'Combo Passport Scotch 1L + Energético Baly Tradicional 2L + Gelo 5kg',
    custo: 52.00,
    venda: 79.90,
    estoque: 16,
    minimo: 3
  },

  // =========================================================================
  // 10. PROMOÇÕES (Itens de Giro Rápido com Preço de Oferta)
  // =========================================================================
  {
    ean: '7891991009997',
    categoria: 'Promoções',
    nome: 'PROMOÇÃO: Cerveja Amstel Lata 350ml (Gelada)',
    custo: 2.80,
    venda: 3.79,
    estoque: 144,
    minimo: 24,
    fardoNome: 'Fardo c/ 12',
    fardoQtd: 12,
    fardoPreco: 43.90,
    fardoEan: '7891991009980'
  },
  {
    ean: '7891991009973',
    categoria: 'Promoções',
    nome: 'PROMOÇÃO: Cerveja Heineken Long Neck 330ml (Super Gelada)',
    custo: 5.20,
    venda: 7.29,
    estoque: 96,
    minimo: 24,
    fardoNome: 'Pack c/ 6',
    fardoQtd: 6,
    fardoPreco: 41.90,
    fardoEan: '7891991009966'
  },
  {
    ean: '7898905000011',
    categoria: 'Promoções',
    nome: 'PROMOÇÃO: Energético Monster Tradicional 473ml (Leve 3 por R$ 27,00)',
    custo: 6.60,
    venda: 9.49,
    estoque: 60,
    minimo: 12
  },
  {
    ean: '7898905000110',
    categoria: 'Promoções',
    nome: 'PROMOÇÃO: Vinho Chileno Concha y Toro Cabernet 750ml (Oferta da Semana)',
    custo: 22.00,
    venda: 31.90,
    estoque: 24,
    minimo: 6
  },
  {
    ean: '7898905000219',
    categoria: 'Promoções',
    nome: 'PROMOÇÃO: Whisky White Horse 1L (Oferta Relâmpago)',
    custo: 51.00,
    venda: 68.90,
    estoque: 20,
    minimo: 4
  },

  // =========================================================================
  // 11. CONVENIÊNCIA (Doces, Chicletes, Carregadores, Pilhas, Higiene Rápida)
  // =========================================================================
  {
    ean: '7891000244100',
    categoria: 'Conveniência',
    nome: 'Chocolate Snickers Original 45g',
    custo: 2.20,
    venda: 4.50,
    estoque: 40,
    minimo: 10
  },
  {
    ean: '7891000244209',
    categoria: 'Conveniência',
    nome: 'Chocolate KitKat Milk Nestlé 41.5g',
    custo: 2.30,
    venda: 4.50,
    estoque: 40,
    minimo: 10
  },
  {
    ean: '7891048030017',
    categoria: 'Conveniência',
    nome: 'Chiclete Trident Menta Caixa c/ 14s',
    custo: 1.80,
    venda: 3.50,
    estoque: 50,
    minimo: 15
  },
  {
    ean: '7891048030024',
    categoria: 'Conveniência',
    nome: 'Chiclete Trident Melancia Caixa c/ 14s',
    custo: 1.80,
    venda: 3.50,
    estoque: 50,
    minimo: 15
  },
  {
    ean: '7891048030116',
    categoria: 'Conveniência',
    nome: 'Bala Halls Extra Forte Preto',
    custo: 1.50,
    venda: 3.00,
    estoque: 50,
    minimo: 15
  },
  {
    ean: '7891048030123',
    categoria: 'Conveniência',
    nome: 'Bala Halls Cereja',
    custo: 1.50,
    venda: 3.00,
    estoque: 40,
    minimo: 12
  },
  {
    ean: '7891058010016',
    categoria: 'Conveniência',
    nome: 'Preservativo Jontex Tradicional (Envelope c/ 3)',
    custo: 3.80,
    venda: 7.90,
    estoque: 30,
    minimo: 6
  },
  {
    ean: '7891058010023',
    categoria: 'Conveniência',
    nome: 'Preservativo Prudence Efeito Retardante (c/ 3)',
    custo: 4.50,
    venda: 8.90,
    estoque: 25,
    minimo: 5
  },
  {
    ean: '7898906000010',
    categoria: 'Conveniência',
    nome: 'Cabo Carregador USB Tipo-C Reforçado 1 Metro',
    custo: 8.00,
    venda: 19.90,
    estoque: 15,
    minimo: 3
  },
  {
    ean: '7898906000027',
    categoria: 'Conveniência',
    nome: 'Cabo Carregador para iPhone Lightning 1 Metro',
    custo: 8.00,
    venda: 19.90,
    estoque: 15,
    minimo: 3
  },
  {
    ean: '7898906000119',
    categoria: 'Conveniência',
    nome: 'Pilha Alcalina Duracell AA (Cartela c/ 2 un)',
    custo: 7.50,
    venda: 14.90,
    estoque: 20,
    minimo: 4
  },
  {
    ean: '7898906000126',
    categoria: 'Conveniência',
    nome: 'Pilha Alcalina Duracell Palito AAA (Cartela c/ 2 un)',
    custo: 7.50,
    venda: 14.90,
    estoque: 20,
    minimo: 4
  },
  {
    ean: '7898906000218',
    categoria: 'Conveniência',
    nome: 'Engov Antiressaca (Envelope c/ 6 comprimidos)',
    custo: 4.80,
    venda: 9.90,
    estoque: 30,
    minimo: 6
  },
  {
    ean: '7898906000317',
    categoria: 'Conveniência',
    nome: 'Epocler Flaconete Digestivo 10ml (Unidade)',
    custo: 1.90,
    venda: 4.00,
    estoque: 40,
    minimo: 10
  }
];

async function gerarPlanilhaAdega() {
  console.log(`Gerando planilha de estoque para Adega com ${produtosAdega.length} produtos em 11 categorias...`);

  const workbook = new ExcelJS.Workbook();
  workbook.creator = 'FlowPDV Gestão Comercial';
  workbook.created = new Date();

  const worksheet = workbook.addWorksheet('Estoque Adega', {
    views: [{ state: 'frozen', ySplit: 1 }]
  });

  // 11 Colunas Oficiais
  worksheet.columns = [
    { header: 'Código de Barras', key: 'codigoBarras', width: 22 },
    { header: 'Categoria', key: 'categoria', width: 20 },
    { header: 'Nome do Produto', key: 'nome', width: 44 },
    { header: 'Preço de Custo (R$)', key: 'precoCusto', width: 18 },
    { header: 'Preço de Venda (R$)', key: 'precoVenda', width: 18 },
    { header: 'Estoque Atual', key: 'estoque', width: 15 },
    { header: 'Estoque Mínimo', key: 'estoqueMinimo', width: 15 },
    { header: 'Nome Embalagem Fardo (Opcional)', key: 'fardoNome', width: 26 },
    { header: 'Qtd por Fardo (Opcional)', key: 'fardoQtd', width: 20 },
    { header: 'Preço Venda Fardo (Opcional)', key: 'fardoPreco', width: 24 },
    { header: 'Código Barras do Fardo (Opcional)', key: 'fardoEan', width: 26 }
  ];

  // Estilização do Cabeçalho
  const headerRow = worksheet.getRow(1);
  headerRow.height = 32;

  headerRow.eachCell((cell, colNumber) => {
    cell.font = { name: 'Segoe UI', size: 11, bold: true, color: { argb: 'FFFFFFFF' } };
    cell.alignment = { vertical: 'middle', horizontal: colNumber >= 4 && colNumber <= 7 ? 'right' : (colNumber >= 8 ? 'center' : 'left') };
    
    if (colNumber <= 7) {
      // Colunas Básicas (Verde Escuro)
      cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF15803D' } };
    } else {
      // Colunas Fardo / Grade (Azul Destaque)
      cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF0284C7' } };
    }

    cell.border = {
      top: { style: 'thin', color: { argb: 'FFCBD5E1' } },
      bottom: { style: 'medium', color: { argb: 'FF0F172A' } },
      left: { style: 'thin', color: { argb: 'FFCBD5E1' } },
      right: { style: 'thin', color: { argb: 'FFCBD5E1' } }
    };
  });

  // Linhas de Produtos
  produtosAdega.forEach((p, idx) => {
    const row = worksheet.addRow({
      codigoBarras: p.ean,
      categoria: p.categoria,
      nome: p.nome,
      precoCusto: p.custo,
      precoVenda: p.venda,
      estoque: p.estoque,
      estoqueMinimo: p.minimo,
      fardoNome: p.fardoNome || '',
      fardoQtd: p.fardoQtd || '',
      fardoPreco: p.fardoPreco || '',
      fardoEan: p.fardoEan || ''
    });

    row.height = 22;

    const bgCor = (idx % 2 === 0) ? 'FFFFFFFF' : 'FFF8FAFC';
    row.eachCell((cell, colNumber) => {
      cell.font = { name: 'Segoe UI', size: 10.5 };
      cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: bgCor } };
      cell.border = {
        bottom: { style: 'thin', color: { argb: 'FFE2E8F0' } },
        left: { style: 'thin', color: { argb: 'FFE2E8F0' } },
        right: { style: 'thin', color: { argb: 'FFE2E8F0' } }
      };

      // Formatação numérica e alinhamento
      if (colNumber === 1 || colNumber === 11) {
        cell.alignment = { vertical: 'middle', horizontal: 'center' };
        cell.numFmt = '@'; // Texto
      } else if (colNumber === 4 || colNumber === 5 || colNumber === 10) {
        cell.alignment = { vertical: 'middle', horizontal: 'right' };
        cell.numFmt = '"R$ "#,##0.00';
      } else if (colNumber === 6 || colNumber === 7 || colNumber === 9) {
        cell.alignment = { vertical: 'middle', horizontal: 'center' };
        cell.numFmt = '#,##0';
      } else {
        cell.alignment = { vertical: 'middle', horizontal: 'left' };
      }
    });
  });

  const caminhoExcel = path.join('D:\\Desenvolvimento', 'Estoque_Adega_Completo.xlsx');
  const caminhoCsv = path.join('D:\\Desenvolvimento', 'Estoque_Adega_Completo.csv');

  await workbook.xlsx.writeFile(caminhoExcel);

  // Gerar CSV formatado com separador ponto e vírgula
  const linhasCsv = [];
  linhasCsv.push('Código de Barras;Categoria;Nome do Produto;Preço de Custo;Preço de Venda;Estoque Atual;Estoque Mínimo;Nome Embalagem Fardo;Qtd por Fardo;Preço Venda Fardo;Código Barras do Fardo');
  
  produtosAdega.forEach(p => {
    const custoFmt = p.custo.toFixed(2).replace('.', ',');
    const vendaFmt = p.venda.toFixed(2).replace('.', ',');
    const fardoPrecoFmt = p.fardoPreco ? p.fardoPreco.toFixed(2).replace('.', ',') : '';
    
    linhasCsv.push(`${p.ean};${p.categoria};${p.nome};${custoFmt};${vendaFmt};${p.estoque};${p.minimo};${p.fardoNome || ''};${p.fardoQtd || ''};${fardoPrecoFmt};${p.fardoEan || ''}`);
  });

  fs.writeFileSync(caminhoCsv, '\uFEFF' + linhasCsv.join('\r\n'), 'utf-8');

  console.log(`✅ Planilha Excel gerada em: ${caminhoExcel}`);
  console.log(`✅ Planilha CSV gerada em: ${caminhoCsv}`);
}

gerarPlanilhaAdega().catch(console.error);
