-- DoujinDesk Database Schema
-- Initial migration for convention management system

-- Create EVENTS table
CREATE TABLE IF NOT EXISTS events (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name VARCHAR(255) NOT NULL,
    description TEXT,
    start_date TIMESTAMP WITH TIME ZONE NOT NULL,
    end_date TIMESTAMP WITH TIME ZONE NOT NULL,
    venue_name VARCHAR(255) NOT NULL,
    venue_address TEXT,
    max_circles INTEGER DEFAULT 0,
    max_attendees INTEGER DEFAULT 0,
    registration_start TIMESTAMP WITH TIME ZONE,
    registration_end TIMESTAMP WITH TIME ZONE,
    status VARCHAR(50) DEFAULT 'draft' CHECK (status IN ('draft', 'published', 'registration_open', 'registration_closed', 'ongoing', 'completed', 'cancelled')),
    currency VARCHAR(3) DEFAULT 'IDR' CHECK (currency IN ('IDR', 'USD')),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    created_by UUID REFERENCES auth.users(id)
);

-- Create CIRCLES table
CREATE TABLE IF NOT EXISTS circles (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    event_id UUID NOT NULL REFERENCES events(id) ON DELETE CASCADE,
    circle_code VARCHAR(20) UNIQUE NOT NULL,
    circle_name VARCHAR(255) NOT NULL,
    circle_name_furigana VARCHAR(255),
    pen_name VARCHAR(255) NOT NULL,
    pen_name_furigana VARCHAR(255),
    email VARCHAR(255) NOT NULL,
    phone VARCHAR(50),
    address TEXT,
    emergency_contact_name VARCHAR(255),
    emergency_contact_phone VARCHAR(50),
    circle_cut_file_url TEXT,
    sample_works_images TEXT[], -- Array of image URLs
    fandom VARCHAR(255),
    genre VARCHAR(255),
    rating VARCHAR(50) CHECK (rating IN ('all_ages', 'r15', 'r18')),
    product_types TEXT[], -- Array of product types
    social_media_twitter VARCHAR(255),
    social_media_pixiv VARCHAR(255),
    social_media_website VARCHAR(255),
    marketplace_link VARCHAR(255),
    space_type VARCHAR(50) CHECK (space_type IN ('circle_space_1', 'circle_space_2', 'circle_space_4', 'circle_booth_a', 'circle_booth_b')),
    additional_table BOOLEAN DEFAULT FALSE,
    additional_chair BOOLEAN DEFAULT FALSE,
    additional_power BOOLEAN DEFAULT FALSE,
    exhibitor_passes INTEGER DEFAULT 1 CHECK (exhibitor_passes BETWEEN 1 AND 4),
    total_amount DECIMAL(10,2) DEFAULT 0,
    payment_status VARCHAR(50) DEFAULT 'pending' CHECK (payment_status IN ('pending', 'paid', 'refunded', 'cancelled')),
    application_status VARCHAR(50) DEFAULT 'pending' CHECK (application_status IN ('pending', 'under_review', 'accepted', 'rejected', 'waitlisted')),
    booth_number VARCHAR(20),
    sells_commission DECIMAL(5,2) DEFAULT 0,
    special_requests TEXT,
    notes TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    user_id UUID REFERENCES auth.users(id)
);

-- Create BOOTHS table
CREATE TABLE IF NOT EXISTS booths (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    event_id UUID NOT NULL REFERENCES events(id) ON DELETE CASCADE,
    booth_number VARCHAR(20) NOT NULL,
    booth_type VARCHAR(50) NOT NULL,
    size_width DECIMAL(5,2),
    size_height DECIMAL(5,2),
    position_x DECIMAL(8,2),
    position_y DECIMAL(8,2),
    floor_level INTEGER DEFAULT 1,
    zone VARCHAR(100),
    status VARCHAR(50) DEFAULT 'available' CHECK (status IN ('available', 'reserved', 'occupied', 'maintenance')),
    circle_id UUID REFERENCES circles(id),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    UNIQUE(event_id, booth_number)
);

-- Create TICKETS table
CREATE TABLE IF NOT EXISTS tickets (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    event_id UUID NOT NULL REFERENCES events(id) ON DELETE CASCADE,
    ticket_type VARCHAR(100) NOT NULL,
    price DECIMAL(10,2) NOT NULL,
    quantity_available INTEGER DEFAULT 0,
    quantity_sold INTEGER DEFAULT 0,
    sale_start TIMESTAMP WITH TIME ZONE,
    sale_end TIMESTAMP WITH TIME ZONE,
    description TEXT,
    benefits TEXT[],
    status VARCHAR(50) DEFAULT 'active' CHECK (status IN ('active', 'inactive', 'sold_out')),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create TICKET_PURCHASES table
CREATE TABLE IF NOT EXISTS ticket_purchases (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    ticket_id UUID NOT NULL REFERENCES tickets(id),
    user_id UUID REFERENCES auth.users(id),
    quantity INTEGER NOT NULL DEFAULT 1,
    total_amount DECIMAL(10,2) NOT NULL,
    payment_status VARCHAR(50) DEFAULT 'pending' CHECK (payment_status IN ('pending', 'paid', 'refunded', 'cancelled')),
    qr_code TEXT,
    rfid_code TEXT,
    attendee_name VARCHAR(255),
    attendee_email VARCHAR(255),
    attendee_phone VARCHAR(50),
    check_in_time TIMESTAMP WITH TIME ZONE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create STAFF table
CREATE TABLE IF NOT EXISTS staff (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    event_id UUID NOT NULL REFERENCES events(id) ON DELETE CASCADE,
    user_id UUID REFERENCES auth.users(id),
    name VARCHAR(255) NOT NULL,
    email VARCHAR(255) NOT NULL,
    phone VARCHAR(50),
    role VARCHAR(100) NOT NULL,
    permissions TEXT[],
    shift_start TIME,
    shift_end TIME,
    assigned_zones TEXT[],
    status VARCHAR(50) DEFAULT 'active' CHECK (status IN ('active', 'inactive', 'on_break')),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create FINANCIAL_TRANSACTIONS table
CREATE TABLE IF NOT EXISTS financial_transactions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    event_id UUID NOT NULL REFERENCES events(id) ON DELETE CASCADE,
    transaction_type VARCHAR(50) NOT NULL CHECK (transaction_type IN ('circle_payment', 'ticket_sale', 'refund', 'expense', 'commission')),
    reference_id UUID, -- Can reference circles.id, ticket_purchases.id, etc.
    amount DECIMAL(10,2) NOT NULL,
    currency VARCHAR(3) NOT NULL,
    payment_method VARCHAR(50),
    payment_gateway VARCHAR(100),
    gateway_transaction_id VARCHAR(255),
    status VARCHAR(50) DEFAULT 'pending' CHECK (status IN ('pending', 'completed', 'failed', 'refunded')),
    description TEXT,
    metadata JSONB,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create indexes for better performance
CREATE INDEX idx_circles_event_id ON circles(event_id);
CREATE INDEX idx_circles_user_id ON circles(user_id);
CREATE INDEX idx_circles_status ON circles(application_status);
CREATE INDEX idx_booths_event_id ON booths(event_id);
CREATE INDEX idx_booths_circle_id ON booths(circle_id);
CREATE INDEX idx_tickets_event_id ON tickets(event_id);
CREATE INDEX idx_ticket_purchases_ticket_id ON ticket_purchases(ticket_id);
CREATE INDEX idx_ticket_purchases_user_id ON ticket_purchases(user_id);
CREATE INDEX idx_staff_event_id ON staff(event_id);
CREATE INDEX idx_staff_user_id ON staff(user_id);
CREATE INDEX idx_financial_transactions_event_id ON financial_transactions(event_id);
CREATE INDEX idx_financial_transactions_reference_id ON financial_transactions(reference_id);

-- Enable Row Level Security
ALTER TABLE events ENABLE ROW LEVEL SECURITY;
ALTER TABLE circles ENABLE ROW LEVEL SECURITY;
ALTER TABLE booths ENABLE ROW LEVEL SECURITY;
ALTER TABLE tickets ENABLE ROW LEVEL SECURITY;
ALTER TABLE ticket_purchases ENABLE ROW LEVEL SECURITY;
ALTER TABLE staff ENABLE ROW LEVEL SECURITY;
ALTER TABLE financial_transactions ENABLE ROW LEVEL SECURITY;

-- Create RLS policies
-- Events policies
CREATE POLICY "Events are viewable by everyone" ON events FOR SELECT USING (true);
CREATE POLICY "Events can be created by authenticated users" ON events FOR INSERT WITH CHECK (auth.uid() = created_by);
CREATE POLICY "Events can be updated by creator" ON events FOR UPDATE USING (auth.uid() = created_by);

-- Circles policies
CREATE POLICY "Circles are viewable by event staff and circle owner" ON circles FOR SELECT USING (
    auth.uid() = user_id OR 
    EXISTS (SELECT 1 FROM staff WHERE staff.user_id = auth.uid() AND staff.event_id = circles.event_id)
);
CREATE POLICY "Circles can be created by authenticated users" ON circles FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Circles can be updated by owner" ON circles FOR UPDATE USING (auth.uid() = user_id);

-- Booths policies
CREATE POLICY "Booths are viewable by everyone" ON booths FOR SELECT USING (true);
CREATE POLICY "Booths can be managed by event staff" ON booths FOR ALL USING (
    EXISTS (SELECT 1 FROM staff WHERE staff.user_id = auth.uid() AND staff.event_id = booths.event_id)
);

-- Tickets policies
CREATE POLICY "Tickets are viewable by everyone" ON tickets FOR SELECT USING (true);
CREATE POLICY "Tickets can be managed by event staff" ON tickets FOR ALL USING (
    EXISTS (SELECT 1 FROM staff WHERE staff.user_id = auth.uid() AND staff.event_id = tickets.event_id)
);

-- Ticket purchases policies
CREATE POLICY "Ticket purchases are viewable by purchaser and event staff" ON ticket_purchases FOR SELECT USING (
    auth.uid() = user_id OR 
    EXISTS (SELECT 1 FROM staff s JOIN tickets t ON t.event_id = s.event_id WHERE s.user_id = auth.uid() AND t.id = ticket_purchases.ticket_id)
);
CREATE POLICY "Ticket purchases can be created by authenticated users" ON ticket_purchases FOR INSERT WITH CHECK (auth.uid() = user_id);

-- Staff policies
CREATE POLICY "Staff are viewable by event staff" ON staff FOR SELECT USING (
    auth.uid() = user_id OR 
    EXISTS (SELECT 1 FROM staff WHERE staff.user_id = auth.uid() AND staff.event_id = staff.event_id)
);

-- Financial transactions policies
CREATE POLICY "Financial transactions are viewable by event staff" ON financial_transactions FOR SELECT USING (
    EXISTS (SELECT 1 FROM staff WHERE staff.user_id = auth.uid() AND staff.event_id = financial_transactions.event_id)
);

-- Grant permissions to authenticated users
GRANT ALL ON events TO authenticated;
GRANT ALL ON circles TO authenticated;
GRANT ALL ON booths TO authenticated;
GRANT ALL ON tickets TO authenticated;
GRANT ALL ON ticket_purchases TO authenticated;
GRANT ALL ON staff TO authenticated;
GRANT ALL ON financial_transactions TO authenticated;

-- Grant read permissions to anonymous users for public data
GRANT SELECT ON events TO anon;
GRANT SELECT ON tickets TO anon;
GRANT SELECT ON booths TO anon;