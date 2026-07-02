#!/bin/bash

test_url() {
  local label="$1"
  local url="$2"
  local extra="${3:-}"
  echo "=== $label ==="
  if [ -n "$extra" ]; then
    docker exec rhportal-api wget -qO- --timeout=15 $extra "$url" 2>&1 | head -c 500 || echo "(falhou ou vazio)"
  else
    docker exec rhportal-api wget -qO- --timeout=15 "$url" 2>&1 | head -c 500 || echo "(falhou ou vazio)"
  fi
  echo
  echo
}

test_url "NOMINATIM cidade+cep" \
  "https://nominatim.openstreetmap.org/search?q=Embu+das+Artes,+SP,+06818-901,+Brasil&format=json&limit=1&countrycodes=br" \
  "--header=User-Agent: Voltage-RenderRH/1.0"

test_url "NOMINATIM bairro+cidade" \
  "https://nominatim.openstreetmap.org/search?q=DAS+OLIVEIRAS,+Embu+das+Artes,+SP,+Brasil&format=json&limit=1&countrycodes=br" \
  "--header=User-Agent: Voltage-RenderRH/1.0"

test_url "NOMINATIM rua com acento" \
  "https://nominatim.openstreetmap.org/search?q=Rua+Jo%C3%A3o+Paulo+I,+900,+Embu+das+Artes,+SP,+Brasil&format=json&limit=1&countrycodes=br" \
  "--header=User-Agent: Voltage-RenderRH/1.0"

test_url "PHOTON endereco completo" \
  "https://photon.komoot.io/api/?q=JOAO+PAULO+I+900,+Embu+das+Artes,+SP,+Brasil&limit=1&lang=pt"

test_url "PHOTON so cidade" \
  "https://photon.komoot.io/api/?q=Embu+das+Artes,+SP,+Brasil&limit=1&lang=pt"

test_url "BRASILAPI v2 06818901" \
  "https://brasilapi.com.br/api/cep/v2/06818901"

test_url "BRASILAPI v2 06817000" \
  "https://brasilapi.com.br/api/cep/v2/06817000"

test_url "NOMINATIM postalcode only" \
  "https://nominatim.openstreetmap.org/search?postalcode=06818-901&country=Brazil&format=json&limit=1" \
  "--header=User-Agent: Voltage-RenderRH/1.0"
