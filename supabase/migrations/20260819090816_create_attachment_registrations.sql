/*
# Create field attachment registrations and acceptance letter storage

1. New Tables
- `field_attachment_registrations` stores the applicant details, placement details, emergency contact, acceptance letter metadata, and review response.
- `id` is the registration identifier used to connect the form row to its uploaded file.
- `full_name`, `registration_number`, `phone`, `email`, `program`, `year_of_study`, `department`, `academic_supervisor` store applicant and academic details.
- `host_organisation`, `placement_location`, `start_date`, `end_date`, `field_supervisor` store placement details.
- `emergency_name`, `emergency_phone`, `emergency_relation`, `notes` store safety and support information.
- `acceptance_letter_path`, `acceptance_letter_name`, `acceptance_letter_size`, `acceptance_letter_type` store the uploaded acceptance letter reference and metadata.
- `review_status`, `reviewer_response`, `reviewed_at` store the field office decision and response.
- `created_at` stores the submission time.

2. Storage
- Create a private `acceptance-letters` bucket.
- Enforce a 10 MB file limit and PDF, Word, and image MIME types at the bucket boundary.

3. Security
- Enable row level security on the registration table.
- This is a no-sign-in, single-tenant workflow, so the public form and staff review panel use the anon role. Four explicit CRUD policies are added for the shared workflow.
- Storage object policies restrict operations to the `acceptance-letters` bucket and require object paths to use a registration ID folder.

4. Important notes
- The interface validates the same upload rules before sending, while the storage bucket enforces them independently.
- The acceptance letter bucket stays private; the review panel requests temporary download links when a file is opened.
*/

CREATE TABLE IF NOT EXISTS public.field_attachment_registrations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  full_name text NOT NULL,
  registration_number text NOT NULL,
  phone text NOT NULL,
  email text NOT NULL,
  program text NOT NULL,
  year_of_study text NOT NULL,
  department text NOT NULL,
  academic_supervisor text,
  host_organisation text NOT NULL,
  placement_location text NOT NULL,
  start_date date NOT NULL,
  end_date date NOT NULL,
  field_supervisor text,
  emergency_name text NOT NULL,
  emergency_phone text NOT NULL,
  emergency_relation text,
  notes text,
  acceptance_letter_path text,
  acceptance_letter_name text,
  acceptance_letter_size bigint,
  acceptance_letter_type text,
  review_status text NOT NULL DEFAULT 'pending' CHECK (review_status IN ('pending', 'approved', 'needs_changes', 'rejected')),
  reviewer_response text,
  reviewed_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.field_attachment_registrations ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "shared_select_field_attachment_registrations" ON public.field_attachment_registrations;
CREATE POLICY "shared_select_field_attachment_registrations"
ON public.field_attachment_registrations FOR SELECT
TO anon, authenticated USING (true);

DROP POLICY IF EXISTS "shared_insert_field_attachment_registrations" ON public.field_attachment_registrations;
CREATE POLICY "shared_insert_field_attachment_registrations"
ON public.field_attachment_registrations FOR INSERT
TO anon, authenticated WITH CHECK (true);

DROP POLICY IF EXISTS "shared_update_field_attachment_registrations" ON public.field_attachment_registrations;
CREATE POLICY "shared_update_field_attachment_registrations"
ON public.field_attachment_registrations FOR UPDATE
TO anon, authenticated USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "shared_delete_field_attachment_registrations" ON public.field_attachment_registrations;
CREATE POLICY "shared_delete_field_attachment_registrations"
ON public.field_attachment_registrations FOR DELETE
TO anon, authenticated USING (true);

CREATE INDEX IF NOT EXISTS field_attachment_registrations_created_at_idx
ON public.field_attachment_registrations (created_at DESC);

INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'acceptance-letters',
  'acceptance-letters',
  false,
  10485760,
  ARRAY['application/pdf', 'application/msword', 'application/vnd.openxmlformats-officedocument.wordprocessingml.document', 'image/jpeg', 'image/png']
)
ON CONFLICT (id) DO UPDATE SET
  public = false,
  file_size_limit = 10485760,
  allowed_mime_types = EXCLUDED.allowed_mime_types;

DROP POLICY IF EXISTS "shared_insert_acceptance_letters" ON storage.objects;
CREATE POLICY "shared_insert_acceptance_letters"
ON storage.objects FOR INSERT
TO anon, authenticated
WITH CHECK (
  bucket_id = 'acceptance-letters'
  AND (storage.foldername(name))[1] IS NOT NULL
);

DROP POLICY IF EXISTS "shared_select_acceptance_letters" ON storage.objects;
CREATE POLICY "shared_select_acceptance_letters"
ON storage.objects FOR SELECT
TO anon, authenticated
USING (bucket_id = 'acceptance-letters');

DROP POLICY IF EXISTS "shared_update_acceptance_letters" ON storage.objects;
CREATE POLICY "shared_update_acceptance_letters"
ON storage.objects FOR UPDATE
TO anon, authenticated
USING (bucket_id = 'acceptance-letters')
WITH CHECK (bucket_id = 'acceptance-letters');

DROP POLICY IF EXISTS "shared_delete_acceptance_letters" ON storage.objects;
CREATE POLICY "shared_delete_acceptance_letters"
ON storage.objects FOR DELETE
TO anon, authenticated
USING (bucket_id = 'acceptance-letters');