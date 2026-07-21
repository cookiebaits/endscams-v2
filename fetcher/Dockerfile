FROM denoland/deno:alpine-1.46.3

WORKDIR /app

COPY main.ts .

# Cache dependencies at build time
RUN deno cache main.ts

EXPOSE 8000

# --allow-net covers Supabase, Google CSE, BBB, Google Sheets
# --allow-env for reading Dokploy env vars
CMD ["deno", "run", "--allow-net", "--allow-env", "main.ts"]
