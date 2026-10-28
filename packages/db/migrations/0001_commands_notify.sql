CREATE OR REPLACE FUNCTION malote_notify_command() RETURNS trigger AS $$
BEGIN
  PERFORM pg_notify('malote_commands', NEW.id::text);
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;
--> statement-breakpoint
CREATE TRIGGER commands_notify AFTER INSERT ON "commands" FOR EACH ROW EXECUTE FUNCTION malote_notify_command();
