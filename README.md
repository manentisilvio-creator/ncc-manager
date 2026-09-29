# NCC Manager v6

Web app per la gestione condivisa dei servizi NCC.

- Supabase Auth + database condiviso
- Aggiornamento automatico/realtime
- Archivio permanente dei servizi
- Autista, veicolo e targa modificabili
- Chilometri di partenza e di arrivo
- Nessun prezzo o metodo di pagamento

## Database
Aggiungere alla tabella `public."Servizi"` i campi:

```sql
alter table public."Servizi"
add column if not exists km_partenza integer,
add column if not exists km_arrivo integer;
```
