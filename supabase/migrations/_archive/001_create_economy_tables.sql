-- Crear tabla economy_expenses (Gastos)
CREATE TABLE IF NOT EXISTS economy_expenses (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  house_id UUID NOT NULL REFERENCES houses(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  
  name VARCHAR(255) NOT NULL,
  amount DECIMAL(12,2) NOT NULL,
  category VARCHAR(50) NOT NULL,
  description TEXT,
  date DATE NOT NULL,
  
  photo_url TEXT,
  photo_storage_path TEXT,
  
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW(),
  
  INDEX idx_house_date (house_id, date),
  INDEX idx_house_category (house_id, category),
  INDEX idx_house_user (house_id, user_id)
);

-- Crear tabla economy_income (Ingresos)
CREATE TABLE IF NOT EXISTS economy_income (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  house_id UUID NOT NULL REFERENCES houses(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  
  name VARCHAR(255) NOT NULL,
  amount DECIMAL(12,2) NOT NULL,
  category VARCHAR(50) NOT NULL,
  description TEXT,
  date DATE NOT NULL,
  
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW(),
  
  INDEX idx_house_date (house_id, date),
  INDEX idx_house_category (house_id, category),
  INDEX idx_house_user (house_id, user_id)
);

-- Crear tabla economy_bills (Facturas)
CREATE TABLE IF NOT EXISTS economy_bills (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  house_id UUID NOT NULL REFERENCES houses(id) ON DELETE CASCADE,
  created_by UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  
  name VARCHAR(255) NOT NULL,
  provider VARCHAR(255),
  amount DECIMAL(12,2) NOT NULL,
  category VARCHAR(50) NOT NULL,
  due_date DATE NOT NULL,
  
  status VARCHAR(20) DEFAULT 'pending',
  frequency VARCHAR(30) DEFAULT 'unique',
  next_due_date DATE,
  
  has_reminder BOOLEAN DEFAULT FALSE,
  reminder_days_before INTEGER DEFAULT 3,
  last_reminder_sent_at TIMESTAMP,
  
  attachment_url TEXT,
  attachment_storage_path TEXT,
  attachment_type VARCHAR(20),
  
  notes TEXT,
  
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW(),
  paid_at TIMESTAMP,
  
  INDEX idx_house_due (house_id, due_date),
  INDEX idx_house_status (house_id, status),
  INDEX idx_house_category (house_id, category)
);

-- Enable Row Level Security
ALTER TABLE economy_expenses ENABLE ROW LEVEL SECURITY;
ALTER TABLE economy_income ENABLE ROW LEVEL SECURITY;
ALTER TABLE economy_bills ENABLE ROW LEVEL SECURITY;

-- RLS Policy: Users can only see expenses from their house
CREATE POLICY "Users see expenses only from their house"
  ON economy_expenses
  FOR SELECT
  USING (
    house_id IN (
      SELECT home_id FROM home_members WHERE user_id = auth.uid()
    )
  );

-- RLS Policy: Users can only create expenses in their house
CREATE POLICY "Users can create expenses in their house"
  ON economy_expenses
  FOR INSERT
  WITH CHECK (
    house_id IN (SELECT home_id FROM home_members WHERE user_id = auth.uid())
  );

-- RLS Policy: Users can only see income from their house
CREATE POLICY "Users see income only from their house"
  ON economy_income
  FOR SELECT
  USING (
    house_id IN (
      SELECT home_id FROM home_members WHERE user_id = auth.uid()
    )
  );

-- RLS Policy: Users can only create income in their house
CREATE POLICY "Users can create income in their house"
  ON economy_income
  FOR INSERT
  WITH CHECK (
    house_id IN (SELECT home_id FROM home_members WHERE user_id = auth.uid())
  );

-- RLS Policy: Users can only see bills from their house
CREATE POLICY "Users see bills only from their house"
  ON economy_bills
  FOR SELECT
  USING (
    house_id IN (
      SELECT home_id FROM home_members WHERE user_id = auth.uid()
    )
  );

-- RLS Policy: Users can only create bills in their house
CREATE POLICY "Users can create bills in their house"
  ON economy_bills
  FOR INSERT
  WITH CHECK (
    house_id IN (SELECT home_id FROM home_members WHERE user_id = auth.uid())
  );
