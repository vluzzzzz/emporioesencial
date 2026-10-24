-- ============================================================================
--  ESENCIAL EMPORIO · Árbol de categorías
--  ----------------------------------------------------------------------------
--  Una sola lista para el menú, los nombres de cada sección y las tarjetas de
--  la portada. Antes estaba repetida en cuatro archivos distintos.
--
--  Pegalo en Supabase → SQL Editor y dale Run. Después se edita desde la web:
--  entrá como administrador, prendé Editar y tocá Categorías.
--
--  Solo siembra el valor inicial: si ya editaste las categorías, no las pisa.
-- ============================================================================

insert into public.site_config (key, value)
values ('categorias_arbol', '[
  {
    "slug": "cocina",
    "nombre": "Cocina",
    "arriba": "Todo en",
    "destacada": true,
    "orden": 1,
    "img": "images/emporio-images/2.webp",
    "medida": "800 × 1000",
    "banner": "images/emporio-images/2.webp",
    "bannerMobile": "images/emporio-images/2.webp",
    "bannerArchivo": "banner-cocina.webp",
    "subs": [
      {
        "slug": "cocina-utensilios",
        "nombre": "Utensilios"
      },
      {
        "slug": "cocina-ollas",
        "nombre": "Ollas y sartenes"
      },
      {
        "slug": "cocina-vajilla",
        "nombre": "Vajilla"
      },
      {
        "slug": "cocina-organizadores",
        "nombre": "Organizadores"
      },
      {
        "slug": "cocina-electro",
        "nombre": "Electro cocina"
      }
    ]
  },
  {
    "slug": "hogar",
    "nombre": "Hogar y decoración",
    "arriba": "Todo en",
    "destacada": false,
    "orden": 2,
    "img": "images/emporio-images/6.webp",
    "medida": "800 × 500",
    "subs": [
      {
        "slug": "hogar-decoracion",
        "nombre": "Decoración"
      },
      {
        "slug": "hogar-textiles",
        "nombre": "Textiles"
      },
      {
        "slug": "hogar-iluminacion",
        "nombre": "Iluminación"
      },
      {
        "slug": "hogar-cuadros",
        "nombre": "Cuadros"
      },
      {
        "slug": "hogar-relojes",
        "nombre": "Relojes"
      }
    ]
  },
  {
    "slug": "belleza",
    "nombre": "Belleza y cuidado personal",
    "arriba": "Todo en",
    "destacada": true,
    "orden": 3,
    "img": "images/emporio-images/3.webp",
    "medida": "800 × 500",
    "banner": "images/emporio-images/3.webp",
    "bannerMobile": "images/emporio-images/3.webp",
    "bannerArchivo": "banner-belleza.webp",
    "subs": [
      {
        "slug": "belleza-maquillaje",
        "nombre": "Maquillaje"
      },
      {
        "slug": "belleza-facial",
        "nombre": "Cuidado facial"
      },
      {
        "slug": "belleza-cabello",
        "nombre": "Cabello"
      },
      {
        "slug": "belleza-unas",
        "nombre": "Uñas"
      },
      {
        "slug": "belleza-accesorios",
        "nombre": "Accesorios"
      }
    ]
  },
  {
    "slug": "herramientas",
    "nombre": "Herramientas",
    "arriba": "Todo en",
    "destacada": true,
    "orden": 4,
    "img": "images/emporio-images/1.webp",
    "medida": "800 × 500",
    "banner": "images/emporio-images/1.webp",
    "bannerMobile": "images/emporio-images/1.webp",
    "bannerArchivo": "banner-herramientas.webp",
    "subs": [
      {
        "slug": "herr-manuales",
        "nombre": "Manuales"
      },
      {
        "slug": "herr-electricas",
        "nombre": "Eléctricas"
      },
      {
        "slug": "herr-puntas",
        "nombre": "Set de puntas"
      },
      {
        "slug": "herr-medicion",
        "nombre": "Medición"
      },
      {
        "slug": "herr-ferreteria",
        "nombre": "Ferretería"
      }
    ]
  },
  {
    "slug": "limpieza",
    "nombre": "Limpieza",
    "arriba": "Todo en",
    "destacada": true,
    "orden": 5,
    "img": "images/emporio-images/4.webp",
    "medida": "800 × 1000",
    "banner": "images/emporio-images/4.webp",
    "bannerMobile": "images/emporio-images/4.webp",
    "bannerArchivo": "banner-limpieza.webp",
    "subs": [
      {
        "slug": "limp-hogar",
        "nombre": "Limpieza hogar"
      },
      {
        "slug": "limp-accesorios",
        "nombre": "Accesorios"
      },
      {
        "slug": "limp-bano",
        "nombre": "Baño"
      },
      {
        "slug": "limp-lavanderia",
        "nombre": "Lavandería"
      }
    ]
  },
  {
    "slug": "organizacion",
    "nombre": "Organización",
    "arriba": "Todo en",
    "destacada": false,
    "orden": 6,
    "img": "images/emporio-images/8.webp",
    "medida": "800 × 500",
    "subs": [
      {
        "slug": "org-cajas",
        "nombre": "Cajas"
      },
      {
        "slug": "org-ganchos",
        "nombre": "Ganchos"
      },
      {
        "slug": "org-closet",
        "nombre": "Closet"
      },
      {
        "slug": "org-cocina",
        "nombre": "Cocina"
      }
    ]
  },
  {
    "slug": "electrodomesticos",
    "nombre": "Electrodomésticos",
    "arriba": "Todo en",
    "destacada": false,
    "orden": 7,
    "img": "images/emporio-images/7.webp",
    "medida": "800 × 500",
    "subs": [
      {
        "slug": "electro-cocina",
        "nombre": "Cocina"
      },
      {
        "slug": "electro-ventilacion",
        "nombre": "Ventilación"
      },
      {
        "slug": "electro-personal",
        "nombre": "Cuidado personal"
      }
    ]
  },
  {
    "slug": "bano",
    "nombre": "Baño",
    "arriba": "Todo en",
    "destacada": false,
    "orden": 8,
    "img": "images/emporio-images/9.webp",
    "medida": "800 × 500",
    "subs": [
      {
        "slug": "bano-accesorios",
        "nombre": "Accesorios"
      },
      {
        "slug": "bano-organizacion",
        "nombre": "Organización"
      },
      {
        "slug": "bano-toallas",
        "nombre": "Toallas"
      }
    ]
  },
  {
    "slug": "dormitorio",
    "nombre": "Dormitorio",
    "arriba": "Todo en",
    "destacada": false,
    "orden": 9,
    "img": "images/emporio-images/13.webp",
    "medida": "800 × 500",
    "subs": [
      {
        "slug": "dorm-cama",
        "nombre": "Ropa de cama"
      },
      {
        "slug": "dorm-almohadas",
        "nombre": "Almohadas"
      },
      {
        "slug": "dorm-organizacion",
        "nombre": "Organización"
      }
    ]
  },
  {
    "slug": "mascotas",
    "nombre": "Mascotas",
    "arriba": "Todo en",
    "destacada": false,
    "orden": 10,
    "img": "images/emporio-images/11.webp",
    "medida": "800 × 500",
    "subs": [
      {
        "slug": "masc-alimentacion",
        "nombre": "Alimentación"
      },
      {
        "slug": "masc-juguetes",
        "nombre": "Juguetes"
      },
      {
        "slug": "masc-higiene",
        "nombre": "Higiene"
      }
    ]
  },
  {
    "slug": "jardin",
    "nombre": "Jardín y exterior",
    "arriba": "Todo en",
    "destacada": false,
    "orden": 11,
    "img": "images/emporio-images/5.webp",
    "medida": "800 × 500",
    "subs": [
      {
        "slug": "jard-herramientas",
        "nombre": "Herramientas"
      },
      {
        "slug": "jard-decoracion",
        "nombre": "Decoración"
      },
      {
        "slug": "jard-riego",
        "nombre": "Riego"
      }
    ]
  },
  {
    "slug": "autos",
    "nombre": "Autos",
    "arriba": "Todo en",
    "destacada": false,
    "orden": 12,
    "img": "images/emporio-images/16.webp",
    "medida": "800 × 500",
    "subs": [
      {
        "slug": "auto-accesorios",
        "nombre": "Accesorios"
      },
      {
        "slug": "auto-limpieza",
        "nombre": "Limpieza"
      },
      {
        "slug": "auto-organizacion",
        "nombre": "Organización"
      }
    ]
  },
  {
    "slug": "tecnologia",
    "nombre": "Tecnología",
    "arriba": "Todo en",
    "destacada": false,
    "orden": 13,
    "img": "images/emporio-images/20.webp",
    "medida": "800 × 500",
    "subs": [
      {
        "slug": "tec-accesorios",
        "nombre": "Accesorios"
      },
      {
        "slug": "tec-cables",
        "nombre": "Cables"
      },
      {
        "slug": "tec-audio",
        "nombre": "Audio"
      }
    ]
  }
]'::jsonb)
on conflict (key) do nothing;
