CREATE TABLE "account" (
	"id" text PRIMARY KEY NOT NULL,
	"account_id" text NOT NULL,
	"provider_id" text NOT NULL,
	"user_id" text NOT NULL,
	"access_token" text,
	"refresh_token" text,
	"id_token" text,
	"access_token_expires_at" timestamp,
	"refresh_token_expires_at" timestamp,
	"scope" text,
	"password" text,
	"created_at" timestamp NOT NULL,
	"updated_at" timestamp NOT NULL
);
--> statement-breakpoint
CREATE TABLE "customer" (
	"student_id" text PRIMARY KEY NOT NULL,
	"name" text NOT NULL,
	"email" text NOT NULL,
	"homeroom" text NOT NULL,
	"ticket_type" text NOT NULL,
	"reservation_attempts" integer DEFAULT 0 NOT NULL,
	"created_at" timestamp NOT NULL
);
--> statement-breakpoint
CREATE TABLE "haunted_house" (
	"name" text PRIMARY KEY NOT NULL,
	"created_at" timestamp NOT NULL,
	"updated_at" timestamp NOT NULL
);
--> statement-breakpoint
CREATE TABLE "queue" (
	"id" text PRIMARY KEY NOT NULL,
	"haunted_house_name" text NOT NULL,
	"queue_number" integer NOT NULL,
	"queue_start_time" timestamp NOT NULL,
	"queue_end_time" timestamp NOT NULL,
	"max_customers" integer NOT NULL,
	"created_at" timestamp NOT NULL,
	"updated_at" timestamp NOT NULL
);
--> statement-breakpoint
CREATE TABLE "queue_spot" (
	"id" text PRIMARY KEY NOT NULL,
	"queue_id" text NOT NULL,
	"spot_number" integer NOT NULL,
	"customer_id" text,
	"reservation_id" text,
	"status" text DEFAULT 'available' NOT NULL,
	"occupied_at" timestamp,
	"created_at" timestamp NOT NULL,
	"updated_at" timestamp NOT NULL
);
--> statement-breakpoint
CREATE TABLE "reservation" (
	"id" text PRIMARY KEY NOT NULL,
	"queue_id" text NOT NULL,
	"representative_customer_id" text NOT NULL,
	"code" text NOT NULL,
	"max_spots" integer NOT NULL,
	"current_spots" integer DEFAULT 1 NOT NULL,
	"expires_at" timestamp NOT NULL,
	"status" text DEFAULT 'active' NOT NULL,
	"created_at" timestamp NOT NULL,
	"updated_at" timestamp NOT NULL,
	CONSTRAINT "reservation_code_unique" UNIQUE("code")
);
--> statement-breakpoint
CREATE TABLE "session" (
	"id" text PRIMARY KEY NOT NULL,
	"expires_at" timestamp NOT NULL,
	"token" text NOT NULL,
	"created_at" timestamp NOT NULL,
	"updated_at" timestamp NOT NULL,
	"ip_address" text,
	"user_agent" text,
	"user_id" text NOT NULL,
	"impersonated_by" text,
	CONSTRAINT "session_token_unique" UNIQUE("token")
);
--> statement-breakpoint
CREATE TABLE "user" (
	"id" text PRIMARY KEY NOT NULL,
	"name" text NOT NULL,
	"email" text NOT NULL,
	"email_verified" boolean NOT NULL,
	"image" text,
	"created_at" timestamp NOT NULL,
	"updated_at" timestamp NOT NULL,
	"role" text DEFAULT 'user' NOT NULL,
	"banned" boolean NOT NULL,
	"ban_reason" text,
	"ban_expires_at" timestamp,
	CONSTRAINT "user_email_unique" UNIQUE("email")
);
--> statement-breakpoint
CREATE TABLE "verification" (
	"id" text PRIMARY KEY NOT NULL,
	"identifier" text NOT NULL,
	"value" text NOT NULL,
	"expires_at" timestamp NOT NULL,
	"created_at" timestamp,
	"updated_at" timestamp
);
--> statement-breakpoint
ALTER TABLE "account" ADD CONSTRAINT "account_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "queue" ADD CONSTRAINT "queue_haunted_house_name_haunted_house_name_fk" FOREIGN KEY ("haunted_house_name") REFERENCES "public"."haunted_house"("name") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "queue_spot" ADD CONSTRAINT "queue_spot_queue_id_queue_id_fk" FOREIGN KEY ("queue_id") REFERENCES "public"."queue"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "queue_spot" ADD CONSTRAINT "queue_spot_customer_id_customer_student_id_fk" FOREIGN KEY ("customer_id") REFERENCES "public"."customer"("student_id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "queue_spot" ADD CONSTRAINT "queue_spot_reservation_id_reservation_id_fk" FOREIGN KEY ("reservation_id") REFERENCES "public"."reservation"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "reservation" ADD CONSTRAINT "reservation_queue_id_queue_id_fk" FOREIGN KEY ("queue_id") REFERENCES "public"."queue"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "reservation" ADD CONSTRAINT "reservation_representative_customer_id_customer_student_id_fk" FOREIGN KEY ("representative_customer_id") REFERENCES "public"."customer"("student_id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "session" ADD CONSTRAINT "session_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "session" ADD CONSTRAINT "session_impersonated_by_user_id_fk" FOREIGN KEY ("impersonated_by") REFERENCES "public"."user"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "idx_account_id" ON "account" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "idx_queue_haunted_house" ON "queue" USING btree ("haunted_house_name");--> statement-breakpoint
CREATE INDEX "idx_queue_haunted_house_number" ON "queue" USING btree ("haunted_house_name","queue_number");--> statement-breakpoint
CREATE INDEX "idx_queue_spot_queue" ON "queue_spot" USING btree ("queue_id");--> statement-breakpoint
CREATE INDEX "idx_queue_spot_customer" ON "queue_spot" USING btree ("customer_id");--> statement-breakpoint
CREATE INDEX "idx_queue_spot_reservation" ON "queue_spot" USING btree ("reservation_id");--> statement-breakpoint
CREATE INDEX "idx_reservation_queue" ON "reservation" USING btree ("queue_id");--> statement-breakpoint
CREATE INDEX "idx_reservation_representative" ON "reservation" USING btree ("representative_customer_id");--> statement-breakpoint
CREATE INDEX "idx_reservation_code" ON "reservation" USING btree ("code");--> statement-breakpoint
CREATE INDEX "idx_session_id" ON "session" USING btree ("user_id");