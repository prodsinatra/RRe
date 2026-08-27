-- Supabase Row Level Security (RLS) Policies for 808 SZN

-- Enable RLS on all tables
ALTER TABLE projects ENABLE ROW LEVEL SECURITY;
ALTER TABLE assets ENABLE ROW LEVEL SECURITY;
ALTER TABLE credits ENABLE ROW LEVEL SECURITY;
ALTER TABLE findings ENABLE ROW LEVEL SECURITY;
ALTER TABLE manifests ENABLE ROW LEVEL SECURITY;

-- 1. Projects: Only authenticated users who are members of the label/project can view or edit
CREATE POLICY "Users can view their own projects"
ON projects FOR SELECT
USING (auth.uid() IN (
  SELECT user_id FROM project_members WHERE project_id = projects.id
));

CREATE POLICY "Users can update their own projects"
ON projects FOR UPDATE
USING (auth.uid() IN (
  SELECT user_id FROM project_members WHERE project_id = projects.id
));

-- 2. Assets: Strictly tied to project access
CREATE POLICY "Users can view assets for their projects"
ON assets FOR SELECT
USING (project_id IN (
  SELECT id FROM projects WHERE auth.uid() IN (
    SELECT user_id FROM project_members WHERE project_id = projects.id
  )
));

-- (Similar rules apply for credits, findings, and manifests)

-- 3. Storage Bucket Rules for Assets (Supabase Storage)
-- Requires users to have access to the project before downloading the Master WAV
CREATE POLICY "Project members can download assets"
ON storage.objects FOR SELECT
USING (
  bucket_id = 'release-assets' AND
  (auth.uid() IN (
    SELECT user_id FROM project_members WHERE project_id::text = (storage.foldername(name))[1]
  ))
);
