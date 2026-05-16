/**
 * =====================================================================
 * Service Model - Subscription Services
 * Company: emeelan
 * =====================================================================
 * Manages services (FamilyTree, Temple, ELS, etc.)
 */

const pool = require('../config/database');

class Service {
  /**
   * Create services table
   */
  static async createTable() {
    const query = `
      CREATE TABLE IF NOT EXISTS services (
        id SERIAL PRIMARY KEY,
        slug VARCHAR(50) UNIQUE NOT NULL,
        name VARCHAR(100) NOT NULL,
        name_hi VARCHAR(100),
        description TEXT,
        description_hi TEXT,
        category VARCHAR(50) NOT NULL,
        price DECIMAL(10,2) DEFAULT 0,
        is_free BOOLEAN DEFAULT true,
        is_active BOOLEAN DEFAULT true,
        features JSONB,
        icon VARCHAR(50),
        color VARCHAR(20),
        sort_order INTEGER DEFAULT 0,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      );

      CREATE INDEX IF NOT EXISTS idx_services_slug ON services(slug);
      CREATE INDEX IF NOT EXISTS idx_services_category ON services(category);
      CREATE INDEX IF NOT EXISTS idx_services_is_active ON services(is_active);
    `;

    try {
      await pool.query(query);
      console.log('✅ Services table ready');
      
      // Seed default services
      await this.seedServices();
    } catch (error) {
      console.error('❌ Error creating services table:', error);
      throw error;
    }
  }

  /**
   * Seed default services
   */
  static async seedServices() {
    try {
      const checkQuery = 'SELECT COUNT(*) as count FROM services';
      const result = await pool.query(checkQuery);
      
      if (parseInt(result.rows[0].count) > 0) {
        console.log('✅ Services already seeded');
        return;
      }

      const services = [
        // Paid Services
        {
          slug: 'family-tree',
          name: 'Family Tree',
          name_hi: 'वंश वृक्ष',
          description: 'Create and manage your complete family tree with unlimited members',
          description_hi: 'असीमित सदस्यों के साथ अपना पूर्ण वंश वृक्ष बनाएं और प्रबंधित करें',
          category: 'premium',
          price: 499.00,
          is_free: false,
          features: JSON.stringify(['Unlimited family members', 'Photo uploads', 'Relationship mapping', 'Export to PDF', 'Share with family']),
          icon: 'git-branch',
          color: '#F9A825',
          sort_order: 1
        },
        {
          slug: 'vanshavali',
          name: 'Vanshavali',
          name_hi: 'वंशावली',
          description: 'Detailed lineage and genealogy records with historical data',
          description_hi: 'ऐतिहासिक डेटा के साथ विस्तृत वंशावली और वंशावली रिकॉर्ड',
          category: 'premium',
          price: 299.00,
          is_free: false,
          features: JSON.stringify(['Lineage tracking', 'Historical records', 'Gotra information', 'Ancestral village', 'Print certificates']),
          icon: 'users',
          color: '#E74C3C',
          sort_order: 2
        },
        {
          slug: 'temple',
          name: 'Temple Services',
          name_hi: 'मंदिर सेवाएं',
          description: 'Temple donations, ceremonies booking, and spiritual services',
          description_hi: 'मंदिर दान, समारोह बुकिंग और आध्यात्मिक सेवाएं',
          category: 'premium',
          price: 199.00,
          is_free: false,
          features: JSON.stringify(['Online donations', 'Ceremony booking', 'Prasad delivery', 'Live darshan', 'E-certificates']),
          icon: 'building2',
          color: '#FF9800',
          sort_order: 3
        },
        {
          slug: 'magazine',
          name: 'Magazine Subscription',
          name_hi: 'पत्रिका सदस्यता',
          description: 'Monthly community magazine with articles, news, and updates',
          description_hi: 'लेख, समाचार और अपडेट के साथ मासिक सामुदायिक पत्रिका',
          category: 'premium',
          price: 299.00,
          is_free: false,
          features: JSON.stringify(['Monthly digital magazine', 'Exclusive articles', 'Community news', 'Event highlights', 'Digital archive access']),
          icon: 'book-open',
          color: '#FF5722',
          sort_order: 9
        },
        {
          slug: 'sanskar',
          name: 'Sanskar Services',
          name_hi: 'संस्कार सेवाएं',
          description: 'Traditional ceremonies and sanskar guidance for life events',
          description_hi: 'जीवन की घटनाओं के लिए पारंपरिक समारोह और संस्कार मार्गदर्शन',
          category: 'premium',
          price: 399.00,
          is_free: false,
          features: JSON.stringify(['16 Sanskar guidance', 'Ceremony planning', 'Priest booking', 'Muhurat consultation', 'Digital certificates']),
          icon: 'award',
          color: '#673AB7',
          sort_order: 10
        },
        // Free Services
        {
          slug: 'els',
          name: 'Events & Listings',
          name_hi: 'घटनाएँ और सूचियाँ',
          description: 'Browse and post community events, news, and announcements',
          description_hi: 'सामुदायिक कार्यक्रम, समाचार और घोषणाएँ ब्राउज़ करें और पोस्ट करें',
          category: 'free',
          price: 0.00,
          is_free: true,
          features: JSON.stringify(['Event listings', 'News updates', 'Community announcements', 'Photo gallery', 'Comments']),
          icon: 'newspaper',
          color: '#2196F3',
          sort_order: 4
        },
        {
          slug: 'gathjod',
          name: 'Gathjod',
          name_hi: 'गठजोड़',
          description: 'Community gatherings, meetups, and social events',
          description_hi: 'सामुदायिक सभाएं, मुलाकातें और सामाजिक कार्यक्रम',
          category: 'free',
          price: 0.00,
          is_free: true,
          features: JSON.stringify(['RSVP management', 'Location maps', 'Attendee list', 'Photo sharing', 'Notifications']),
          icon: 'calendar',
          color: '#4CAF50',
          sort_order: 5
        },
        {
          slug: 'jobs',
          name: 'Jobs',
          name_hi: 'नौकरियां',
          description: 'Job postings and career opportunities within the community',
          description_hi: 'समुदाय के भीतर नौकरी पोस्टिंग और करियर के अवसर',
          category: 'free',
          price: 0.00,
          is_free: true,
          features: JSON.stringify(['Job listings', 'Apply online', 'Resume upload', 'Job alerts', 'Employer connect']),
          icon: 'user',
          color: '#9C27B0',
          sort_order: 6
        },
        {
          slug: 'agriculture',
          name: 'Agriculture',
          name_hi: 'कृषि',
          description: 'Agricultural products, farming tips, and market information',
          description_hi: 'कृषि उत्पाद, खेती की युक्तियाँ और बाजार की जानकारी',
          category: 'free',
          price: 0.00,
          is_free: true,
          features: JSON.stringify(['Product listings', 'Farming tips', 'Market prices', 'Buy/Sell', 'Expert advice']),
          icon: 'globe',
          color: '#8BC34A',
          sort_order: 7
        },
        {
          slug: 'business',
          name: 'Business',
          name_hi: 'व्यवसाय',
          description: 'Business directory, partnerships, and trade opportunities',
          description_hi: 'व्यवसाय निर्देशिका, साझेदारी और व्यापार के अवसर',
          category: 'free',
          price: 0.00,
          is_free: true,
          features: JSON.stringify(['Business directory', 'Partnerships', 'Trade opportunities', 'Networking', 'Promotions']),
          icon: 'building2',
          color: '#00BCD4',
          sort_order: 8
        }
      ];

      for (const service of services) {
        await pool.query(`
          INSERT INTO services (slug, name, name_hi, description, description_hi, category, price, is_free, features, icon, color, sort_order)
          VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12)
        `, [service.slug, service.name, service.name_hi, service.description, service.description_hi, service.category, service.price, service.is_free, service.features, service.icon, service.color, service.sort_order]);
      }

      console.log(`✅ Seeded ${services.length} services`);
    } catch (error) {
      console.log('⚠️ Could not seed services:', error.message);
    }
  }

  /**
   * Get all active services
   */
  static async findAll() {
    const query = `
      SELECT * FROM services 
      WHERE is_active = true 
      ORDER BY sort_order ASC, name ASC
    `;
    const result = await pool.query(query);
    return result.rows;
  }

  /**
   * Get services by category
   */
  static async findByCategory(category) {
    const query = `
      SELECT * FROM services 
      WHERE category = $1 AND is_active = true 
      ORDER BY sort_order ASC
    `;
    const result = await pool.query(query, [category]);
    return result.rows;
  }

  /**
   * Get service by slug
   */
  static async findBySlug(slug) {
    const query = 'SELECT * FROM services WHERE slug = $1';
    const result = await pool.query(query, [slug]);
    return result.rows[0];
  }

  /**
   * Get service by ID
   */
  static async findById(id) {
    const query = 'SELECT * FROM services WHERE id = $1';
    const result = await pool.query(query, [id]);
    return result.rows[0];
  }
}

module.exports = Service;
