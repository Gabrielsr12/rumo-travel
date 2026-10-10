# Rumo — planejador de viagens visual

Monte uma viagem adicionando lugares e veja no mapa a sequência numerada, as rotas reais entre os pontos, distâncias, tempos, meios de transporte, a agenda de cada dia e alertas de horário.

**Stack:** Next.js 15 (App Router) · React 19 · TypeScript · Tailwind CSS · componentes no padrão shadcn/ui (Radix) · Lucide · Leaflet + OpenStreetMap · Zustand · dnd-kit.

## Rodando

```bash
npm install
cp .env.example .env.local   # opcional — funciona sem nenhuma chave
npm run dev                  # http://localhost:3000
```

Outros comandos: `npm run build`, `npm run typecheck`, `npm test`.

Na primeira abertura é criada uma viagem de exemplo (Paris, 12–15 jun 2027, 4 dias, ~20 lugares) para testar adicionar, remover, reordenar, mover entre dias, rotas, transporte e sugestões.

## Por que Leaflet + OpenStreetMap

| | Leaflet + OSM | Mapbox | Google Maps |
|---|---|---|---|
| Custo para começar | grátis, sem chave | cota grátis, exige token | cota grátis, exige cartão |
| Rotas a pé/bike/carro | OSRM (grátis) | Directions (pago por uso) | Routes (pago por uso) |
| Transporte público | — | — | ✅ |

O app usa OSM por padrão (zero configuração) e **troca de provedor por variável de ambiente**, sem mudar a interface:

- **Rotas a pé/bike/carro:** OSRM público da FOSSGIS → defina `MAPBOX_ACCESS_TOKEN` para usar Mapbox Directions/Matrix, ou `OSRM_BASE_URL` para seu próprio OSRM.
- **Transporte público:** defina `GOOGLE_MAPS_API_KEY` (ative a **Routes API** no Google Cloud). Sem ela, trechos de transporte público mostram “sem dados” e o app exibe apenas as estações próximas reais (OSM).
- **Visual do mapa:** CARTO Voyager por padrão → `NEXT_PUBLIC_MAPBOX_TOKEN` (token público `pk.*`) ou `NEXT_PUBLIC_MAP_TILE_URL`.

### Configurando as chaves

1. **Mapbox:** crie uma conta em mapbox.com → *Access tokens*. Use um token **secreto** em `MAPBOX_ACCESS_TOKEN` (servidor) e, se quiser os tiles da Mapbox, um token **público** em `NEXT_PUBLIC_MAPBOX_TOKEN`.
2. **Google (transporte público):** console.cloud.google.com → crie um projeto → ative *Routes API* → *Credenciais* → crie uma chave de API e restrinja-a à Routes API. Coloque em `GOOGLE_MAPS_API_KEY`.
3. **Contato OSM:** preencha `APP_CONTACT_EMAIL` — as políticas de uso do Overpass/OSRM/Photon pedem identificação.

Todas as chaves de servidor ficam apenas no servidor: o navegador chama as rotas `/api/*` do próprio app.

> Os servidores públicos (OSRM da FOSSGIS, Overpass, Photon) são para uso moderado. Para produção com tráfego, use Mapbox/Google ou hospede os seus.

## Dados honestos

O app **não inventa** distâncias, tempos, horários de metrô, horários de funcionamento, avaliações ou rotas:

- Trecho sem rota disponível → linha tracejada cinza “sem rota (linha reta)” e o horário do dia é marcado como “não considera o trajeto”.
- Distâncias em linha reta só aparecem para proximidade (ex.: “650 m de Louvre (linha reta)”), sempre rotuladas.
- Horários de funcionamento vêm do OpenStreetMap quando existem; os da viagem de exemplo têm o selo **“Dado de exemplo”**. Formatos que o parser não entende desativam alertas daquele local em vez de adivinhar.
- Avaliações não aparecem porque o OSM não as fornece (o tipo `Place.rating` existe para um provedor que forneça).

## Estrutura

```
app/
  page.tsx                    Landing
  trips/                      Lista de viagens · new/ (criar) · [tripId]/ (dashboard)
  trips/[tripId]/plan         Mapa + roteiro + agenda (o coração do app)
  trips/[tripId]/budget       Orçamento
  explore/                    Roteiros sugeridos
  map/                        Abre a viagem mais recente no mapa
  settings/                   Provedores ativos e dados locais
  api/{route,matrix,geocode,places,stations,config}   Proxy para provedores
components/
  map/        Contrato MapViewProps + implementação Leaflet (trocável)
  route/      Lista arrastável, trechos entre paradas, sugestões de rota
  trip/       Agenda do dia, alertas, edição de atividade, barra da viagem
  places/     Busca, categorias, cards de lugar, menu “adicionar”
  transport/  Ícones de meio, estações próximas
  planner/    Layout desktop (sidebar) e mobile (bottom sheet)
  ui/         Primitivos no estilo shadcn/ui
lib/
  server/     Provedores (OSRM, Mapbox, Google Routes, Photon, Overpass) — só servidor
  services/   Camada de serviço do cliente (única porta de entrada para as APIs)
  planner/    Agenda, alertas, otimização (TSP exato ≤ 8 paradas, 2-opt acima), sugestões, estatísticas
  store/      Zustand: viagens (persistidas no navegador), cache de rotas, estado da tela
  data/       Viagem de exemplo, roteiros sugeridos, destinos populares
```

### Trocando o mapa

`components/map/types.ts` define `MapViewProps` (marcadores, rotas, foco, enquadramento). Para usar Mapbox GL ou Google Maps, implemente um componente com essas props e troque o import em `components/map/map-view.tsx`.

### Persistência

As viagens são salvas no `localStorage` (chave `rumo-trips-v1`). Para sincronizar entre dispositivos, substitua o `storage` do `persist` em `lib/store/trips.ts` por um backend (ex.: Supabase) — o restante do app não muda.

## Como funcionam as sugestões

- **Organizar melhor roteiro:** busca a matriz de tempos real (OSRM/Mapbox) entre todos os lugares do dia e minimiza o tempo de deslocamento, penalizando visitas fora do horário de funcionamento e atrasos em horários fixos. Mantém o primeiro lugar (e o último, se for hotel/aeroporto ou tiver horário fixo). Nunca aplica sem confirmação.
- **Encontrar melhor caminho:** compara caminhada, bicicleta e carro trecho a trecho e escolhe ordem + meio conforme a preferência (mais rápido, mais curto, mais econômico, mais confortável). Trechos de transporte público só têm tempo calculado com um provedor configurado.

## Publicando (GitHub + Vercel)

1. Crie um repositório vazio no GitHub e envie o código:
   ```bash
   git remote add origin https://github.com/<seu-usuario>/rumo.git
   git push -u origin main
   ```
2. Na Vercel, importe o repositório (ou conecte-o ao projeto existente em *Settings → Git*).
3. Configure as variáveis de ambiente em *Settings → Environment Variables* (todas opcionais; sem elas o app usa os serviços públicos gratuitos):

   | Variável | Uso |
   | --- | --- |
   | `GOOGLE_MAPS_API_KEY` | Rotas de transporte público (Google Routes API) — só no servidor |
   | `MAPBOX_ACCESS_TOKEN` | Rotas a pé/carro/bike via Mapbox — só no servidor |
   | `NEXT_PUBLIC_MAPBOX_TOKEN` | Mapa base Mapbox no navegador (use um token público `pk.` com restrição de URL) |
   | `APP_CONTACT_EMAIL` | Identificação nos pedidos aos serviços OpenStreetMap |

   O mesmo token público `pk.` do Mapbox pode ser usado nas duas variáveis do Mapbox.

**Nunca** coloque chaves no código nem faça commit de `.env.local` — o `.gitignore` já bloqueia esses arquivos. Use `.env.example` como modelo local.

`scripts/screenshots.mjs` é opcional e precisa do Playwright (`npm i -D playwright`).
