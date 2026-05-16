You are a senior system architect and data modeler.

Your task is to design and generate a hierarchical organizational system for a society-based structure used for coordination, data collection, and activities.

The hierarchy follows Indian administrative and cultural structures (Madhya Pradesh context).

────────────────────────────────
1. ORGANIZATIONAL HIERARCHY
────────────────────────────────

Top-down hierarchy (single tree):

Prant (l1)
 └── Sambhag(l2)
     └── Vibhag(l3)
         └── Jila(l4)
             ├── PART 1: Rural Structure
             │     └── Khand(l5a1)
             │         └── Mandal(l5a2)
             │             └── Gram (l5a3)
             └── PART 2: Urban Structure
                   └── Nagar(l5b1)
                       └── Basti(l5b2)
                           └── Mohalla(l5b3)

Here we have level l1 to l5a3/l5b3 . 
Rules:
• Entire system starts from Prant and flows down to Gram and Mohalla.
• Sambhag acts as regional root under Prant.
• Each node can have members assigned to it.

────────────────────────────────
2. MEMBER MODEL
────────────────────────────────

At ANY level (Prant to Mohalla), members can be attached.

Each member must include:
• Full Name (Indian village-style names from MP)
• Mobile Number
• Avatar Photo (mock image URL / placeholder)
• Address (auto-derived or custom)
• Category (Religion):
  - Hindu
  - Christian
  - Muslim
  - Non-Hindu
• Sensitivity Flag:
  - Sensitive
  - Non-Sensitive

Constraints:
• Approx. 10% members must belong to "Non-Hindu"
• Sensitivity can be derived from role or manually assigned

────────────────────────────────
3. GEOGRAPHICAL SEED DATA REQUIREMENT
────────────────────────────────

Prant:
• Malwa

Sambhag (Roots under Malwa):
• Ujjain Sambhag
• Indore Sambhag

Use Ujjain and Indore as ROOT Sambhag nodes.

Example hierarchy constraint:
• Vibhag "Dharma" must be under Indore Sambhag
• Indore Sambhag must be under Malwa Prant

You must define:
• At least 2 Vibhag per Sambhag
• At least 1 Jila per Vibhag
• Both Rural (Khand → Mandal → Gram) and Urban (Nagar → Basti → Mohalla) paths
• Members attached at EVERY level to demonstrate flexibility

────────────────────────────────
4. RBAC (ROLE-BASED ACCESS CONTROL)
────────────────────────────────

Define demo roles:
• Super Admin (full access)
• Prant Admin
• Sambhag Admin
• Vibhag Admin
• Jila Coordinator
• Area Volunteer (Khand / Nagar / Gram / Mohalla)

Access rules:
• Users can view only their level and below
• Editing rights limited by role
• Sensitive members visible only to higher roles

────────────────────────────────
5. ACTIVITIES & USAGE
────────────────────────────────

The system supports:
• Data collection at all levels
• Activity planning (meetings, events, drives)
• Assignment of responsibility by hierarchy
• Analytics by region, category, sensitivity

────────────────────────────────
6. OUTPUT EXPECTATIONS
────────────────────────────────

You must generate:
1. Logical data model (hierarchy + members)
2. Seed data (Malwa, Ujjain, Indore, Dharma Vibhag, etc.)
3. Mock member records with realistic MP village naming
4. Presentation demo plan with filters
5. RBAC demo scenario

Design should be scalable, readable, and suitable for a web-based admin system.