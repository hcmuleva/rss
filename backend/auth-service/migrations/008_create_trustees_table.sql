/**
 * =====================================================================
 * Migration: Create Trustees Table
 * Created: 2026-04-07
 * =====================================================================
 * Stores temple trustee/board member information
 */

-- Create trustees table
CREATE TABLE IF NOT EXISTS temple_trustees (
  id SERIAL PRIMARY KEY,
  temple_id INTEGER NOT NULL REFERENCES temples(id) ON DELETE CASCADE,
  user_id INTEGER REFERENCES users(id) ON DELETE SET NULL,
  
  -- Basic Info
  name VARCHAR(255) NOT NULL,
  father_name VARCHAR(255),
  husband_name VARCHAR(255),
  designation VARCHAR(100),
  photo_url TEXT,
  
  -- Contact
  phone VARCHAR(20),
  email VARCHAR(255),
  
  -- Donation/Contribution
  amount DECIMAL(15, 2) DEFAULT 0,
  contribution_date DATE,
  
  -- Native Address
  native_address TEXT,
  native_village VARCHAR(100),
  native_district VARCHAR(100),
  native_state VARCHAR(100),
  native_pincode VARCHAR(10),
  
  -- Current Address
  current_address TEXT,
  current_city VARCHAR(100),
  current_state VARCHAR(100),
  current_pincode VARCHAR(10),
  
  -- Additional Info
  about_text TEXT,
  achievements JSONB DEFAULT '[]',
  youtube_video_id VARCHAR(50),
  
  -- Status
  is_active BOOLEAN DEFAULT true,
  display_order INTEGER DEFAULT 0,
  
  -- Audit
  created_by INTEGER REFERENCES users(id) ON DELETE SET NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Create indexes
CREATE INDEX IF NOT EXISTS idx_trustees_temple ON temple_trustees(temple_id);
CREATE INDEX IF NOT EXISTS idx_trustees_user ON temple_trustees(user_id);
CREATE INDEX IF NOT EXISTS idx_trustees_active ON temple_trustees(is_active);
CREATE INDEX IF NOT EXISTS idx_trustees_order ON temple_trustees(display_order);

-- Add comments
COMMENT ON TABLE temple_trustees IS 'Temple trust board members and trustees';
COMMENT ON COLUMN temple_trustees.achievements IS 'JSON array of achievement strings';
COMMENT ON COLUMN temple_trustees.amount IS 'Contribution/donation amount';

-- Insert sample data for Temple 3 (Siwai Mataji Mandir)
INSERT INTO temple_trustees (
  temple_id, name, father_name, designation, phone, email,
  amount, contribution_date,
  native_address, native_village, native_district, native_state, native_pincode,
  current_address, current_city, current_state, current_pincode,
  about_text, achievements, youtube_video_id,
  display_order, created_at
) VALUES
(
  3, 'Ramesh Kumar Seervi', 'Late Shri Mohan Lal Seervi', 'President',
  '+91 98765 43210', 'ramesh.kumar@example.com',
  500000, '2024-01-15',
  'Village Ozhr, Near Mataji Temple', 'Ozhr', 'Barwani', 'Madhya Pradesh', '451449',
  '123, MG Road, Indore', 'Indore', 'Madhya Pradesh', '452001',
  'Ramesh Kumar Seervi is a distinguished businessman and philanthropist who has been serving as the President of the temple trust for the past 5 years. His dedication to community service and temple development has been exemplary.',
  '["Led the temple renovation project worth ₹2 Crore in 2022", "Established scholarship program for 50 students annually", "Organized 100+ community welfare programs", "Received Seva Ratna award from the community in 2023", "Successfully managed temple finances with 100% transparency"]',
  'dQw4w9WgXcQ',
  1, CURRENT_TIMESTAMP
),
(
  3, 'Prakash Verma', 'Shri Govind Das Verma', 'Vice President',
  '+91 98765 43211', 'prakash.verma@example.com',
  250000, '2024-02-20',
  'Village Siwai, Main Road', 'Siwai', 'Barwani', 'Madhya Pradesh', '451447',
  '456, AB Road, Indore', 'Indore', 'Madhya Pradesh', '452002',
  'Prakash Verma is an accomplished industrialist with over 25 years of experience in manufacturing. He joined the temple trust as Vice President in 2021 and has been instrumental in modernizing temple operations.',
  '["Implemented digital donation system increasing transparency by 200%", "Established medical camp program serving 500+ families", "Launched mobile app for temple services", "Reduced operational costs by 30% through efficient management", "Organized annual job fair connecting 100+ youth with employment"]',
  'jNQXAC9IVRw',
  2, CURRENT_TIMESTAMP
),
(
  3, 'Sanjay Patel', 'Shri Ramesh Patel', 'Treasurer',
  '+91 98765 43212', 'sanjay.patel@example.com',
  150000, '2024-03-10',
  'Village Pansemal, Temple Street', 'Pansemal', 'Barwani', 'Madhya Pradesh', '451446',
  '789, Ring Road, Indore', 'Indore', 'Madhya Pradesh', '452003',
  'Sanjay Patel is a Chartered Accountant with 20 years of experience in financial management. As the Treasurer of the temple trust, he ensures complete financial transparency and compliance.',
  '["Achieved 100% audit clearance for 5 consecutive years", "Increased temple corpus by 150% through wise investments", "Established emergency fund of ₹50 lakhs", "Implemented quarterly financial reporting system", "Received Excellence in Financial Management award"]',
  'kJQP7kiw5Fk',
  3, CURRENT_TIMESTAMP
),
(
  3, 'Vijay Sharma', 'Late Shri Kishan Lal Sharma', 'Trustee',
  '+91 98765 43213', 'vijay.sharma@example.com',
  100000, '2024-04-05',
  'Village Talun, Near School', 'Talun', 'Barwani', 'Madhya Pradesh', '451448',
  '321, Vijay Nagar, Indore', 'Indore', 'Madhya Pradesh', '452004',
  'Vijay Sharma is a respected social worker and educationist who has dedicated his life to community development. As a trustee, he focuses on educational initiatives and youth empowerment.',
  '["Started free coaching classes for 200+ students", "Distributed 500+ books to village libraries", "Organized 50+ skill development workshops", "Established computer training center for rural youth", "Received Shiksha Ratna award for educational contribution"]',
  '9bZkp7q19f0',
  4, CURRENT_TIMESTAMP
),
(
  3, 'Anil Gupta', 'Shri Mahesh Gupta', 'Trustee',
  '+91 98765 43214', 'anil.gupta@example.com',
  75000, '2024-05-01',
  'Village Niwali, Temple Road', 'Niwali', 'Barwani', 'Madhya Pradesh', '451445',
  '654, Scheme No 54, Indore', 'Indore', 'Madhya Pradesh', '452005',
  'Anil Gupta is a successful entrepreneur and technology enthusiast. He brings modern technological solutions to temple management and has been pivotal in digitizing temple operations.',
  '["Launched temple website with 10,000+ monthly visitors", "Implemented online puja booking system", "Created virtual darshan facility for NRI devotees", "Established social media presence reaching 50,000+ followers", "Developed mobile app for temple services with 5,000+ downloads"]',
  'ZZ5LpwO-An4',
  5, CURRENT_TIMESTAMP
);

-- Verify
SELECT id, name, designation, phone, amount FROM temple_trustees ORDER BY display_order;

COMMIT;
