FROM node:20-alpine AS builder

WORKDIR /app

COPY package*.json ./
RUN npm ci

COPY . .

ARG VITE_SUPABASE_URL=https://rnrqvdwtbehilaoyzfgf.supabase.co
ARG VITE_SUPABASE_ANON_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InJucnF2ZHd0YmVoaWxhb3l6ZmdmIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzM0OTk3MDcsImV4cCI6MjA4OTA3NTcwN30.UMn_5tcDhBcdalUg_Z-b_y0M-BmRxhoHvv-GrhAYvwQ

ENV VITE_SUPABASE_URL=$VITE_SUPABASE_URL
ENV VITE_SUPABASE_ANON_KEY=$VITE_SUPABASE_ANON_KEY

RUN npm run build

FROM nginx:1.27-alpine

COPY --from=builder /app/dist /usr/share/nginx/html
COPY nginx.conf /etc/nginx/conf.d/default.conf

EXPOSE 80

CMD ["nginx", "-g", "daemon off;"]
