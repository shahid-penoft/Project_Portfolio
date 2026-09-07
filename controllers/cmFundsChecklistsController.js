import pool from '../configs/db.js';

// ==========================================
// 1. Document Types (Master List)
// ==========================================

export const listDocumentTypes = async (req, res) => {
  try {
    const [rows] = await pool.query('SELECT * FROM cm_fund_document_types ORDER BY sort_order ASC, created_at DESC');
    res.json({ data: rows });
  } catch (err) {
    console.error('Error in listDocumentTypes:', err);
    res.status(500).json({ error: 'Failed to fetch document types' });
  }
};

export const createDocumentType = async (req, res) => {
  try {
    const { id, name, description, requirement } = req.body;
    if (!name || !id) {
      return res.status(400).json({ error: 'Document ID and Name are required' });
    }

    await pool.query(
      `INSERT INTO cm_fund_document_types (id, name, description, requirement) VALUES (?, ?, ?, ?)`,
      [id, name, description || '', requirement || 'Optional']
    );

    res.status(201).json({ message: 'Document type created successfully' });
  } catch (err) {
    console.error('Error in createDocumentType:', err);
    if (err.code === 'ER_DUP_ENTRY') {
      return res.status(400).json({ error: 'Document ID already exists' });
    }
    res.status(500).json({ error: 'Failed to create document type' });
  }
};

export const updateDocumentType = async (req, res) => {
  try {
    const { id } = req.params;
    const { name, description, requirement, status } = req.body;

    if (!name) return res.status(400).json({ error: 'Name is required' });

    await pool.query(
      `UPDATE cm_fund_document_types SET name = ?, description = ?, requirement = ?, status = ? WHERE id = ?`,
      [name, description || '', requirement || 'Optional', status || 'Active', id]
    );

    res.json({ message: 'Document type updated successfully' });
  } catch (err) {
    console.error('Error in updateDocumentType:', err);
    res.status(500).json({ error: 'Failed to update document type' });
  }
};

export const toggleDocumentStatus = async (req, res) => {
  try {
    const { id } = req.params;
    const { status } = req.body;
    if (!status) return res.status(400).json({ error: 'Status is required' });

    await pool.query(
      `UPDATE cm_fund_document_types SET status = ? WHERE id = ?`,
      [status, id]
    );

    res.json({ message: 'Document status updated successfully' });
  } catch (err) {
    console.error('Error in toggleDocumentStatus:', err);
    res.status(500).json({ error: 'Failed to update document status' });
  }
};

export const deleteDocumentType = async (req, res) => {
  try {
    const { id } = req.params;
    
    // Configs are cascade deleted by FK constraint.
    await pool.query(`DELETE FROM cm_fund_document_types WHERE id = ?`, [id]);
    
    res.json({ message: 'Document type deleted successfully' });
  } catch (err) {
    console.error('Error in deleteDocumentType:', err);
    res.status(500).json({ error: 'Failed to delete document type' });
  }
};

// ==========================================
// 2. Categories
// ==========================================

export const listCategories = async (req, res) => {
  try {
    const [rows] = await pool.query('SELECT * FROM cm_fund_categories ORDER BY sort_order ASC, created_at ASC');
    res.json({ data: rows });
  } catch (err) {
    console.error('Error in listCategories:', err);
    res.status(500).json({ error: 'Failed to fetch categories' });
  }
};

export const addCategory = async (req, res) => {
  try {
    const { name, applicationType = 'General' } = req.body;
    if (!name) return res.status(400).json({ error: 'Category name is required' });

    const [result] = await pool.query(
      `INSERT INTO cm_fund_categories (name, application_type) VALUES (?, ?)`,
      [name, applicationType]
    );

    // Mirror to mla_dropdown_lists under cm_fund_category
    try {
      const [[parentRow]] = await pool.query(
        'SELECT id FROM mla_dropdown_lists WHERE `key` = "cm_fund_category" AND value = ? LIMIT 1',
        [applicationType]
      );
      const parentId = parentRow ? parentRow.id : 0;
      await pool.query(
        `INSERT INTO mla_dropdown_lists (parent_id, \`key\`, module, label, value, status, sort_order)
         VALUES (?, 'cm_fund_category', 'CM Funds', ?, ?, 'Active', 0)`,
        [parentId, name, name]
      );
    } catch (e) {
      console.warn('[addCategory] Dropdown mirror warning:', e.message);
    }

    res.status(201).json({ message: 'Category added successfully', id: result.insertId });
  } catch (err) {
    console.error('Error in addCategory:', err);
    if (err.code === 'ER_DUP_ENTRY') {
      return res.status(400).json({ error: 'Category name already exists for this type' });
    }
    res.status(500).json({ error: 'Failed to add category' });
  }
};

export const updateCategory = async (req, res) => {
  try {
    const { id } = req.params;
    const { name, applicationType = 'General' } = req.body;
    if (!name) return res.status(400).json({ error: 'Category name is required' });

    const [[oldCat]] = await pool.query('SELECT name, application_type FROM cm_fund_categories WHERE id = ?', [id]);

    await pool.query(
      `UPDATE cm_fund_categories SET name = ?, application_type = ? WHERE id = ?`,
      [name, applicationType, id]
    );

    // Mirror rename to mla_dropdown_lists
    if (oldCat) {
      try {
        const [[parentRow]] = await pool.query(
          'SELECT id FROM mla_dropdown_lists WHERE `key` = "cm_fund_category" AND value = ? LIMIT 1',
          [applicationType]
        );
        const parentId = parentRow ? parentRow.id : 0;
        await pool.query(
          `UPDATE mla_dropdown_lists SET label = ?, value = ?, parent_id = ?
           WHERE \`key\` = 'cm_fund_category' AND value = ?`,
          [name, name, parentId, oldCat.name]
        );
      } catch (e) {
        console.warn('[updateCategory] Dropdown mirror warning:', e.message);
      }
    }

    res.json({ message: 'Category updated successfully' });
  } catch (err) {
    console.error('Error in updateCategory:', err);
    if (err.code === 'ER_DUP_ENTRY') {
      return res.status(400).json({ error: 'Category name already exists for this type' });
    }
    res.status(500).json({ error: 'Failed to update category' });
  }
};

export const removeCategory = async (req, res) => {
  try {
    const { id } = req.params;
    const [[oldCat]] = await pool.query('SELECT name FROM cm_fund_categories WHERE id = ?', [id]);

    // Configs cascade delete
    await pool.query(`DELETE FROM cm_fund_categories WHERE id = ?`, [id]);

    // Mirror removal from mla_dropdown_lists
    if (oldCat) {
      try {
        await pool.query(
          `DELETE FROM mla_dropdown_lists WHERE \`key\` = 'cm_fund_category' AND value = ?`,
          [oldCat.name]
        );
      } catch (e) {
        console.warn('[removeCategory] Dropdown mirror warning:', e.message);
      }
    }

    res.json({ message: 'Category deleted successfully' });
  } catch (err) {
    console.error('Error in removeCategory:', err);
    res.status(500).json({ error: 'Failed to delete category' });
  }
};

// ==========================================
// 3. Category Configs
// ==========================================

export const getCategoryConfig = async (req, res) => {
  try {
    const { id } = req.params;
    const [rows] = await pool.query(`
      SELECT c.id as config_id, c.doc_id, d.name as doc_name, d.description as doc_description, 
             c.requirement, c.sort_order
      FROM cm_fund_category_document_config c
      JOIN cm_fund_document_types d ON c.doc_id = d.id
      WHERE c.category_id = ?
      ORDER BY c.sort_order ASC, c.created_at ASC
    `, [id]);

    res.json({ data: rows });
  } catch (err) {
    console.error('Error in getCategoryConfig:', err);
    res.status(500).json({ error: 'Failed to fetch category config' });
  }
};

export const saveCategoryConfig = async (req, res) => {
  const connection = await pool.getConnection();
  try {
    const { id } = req.params;
    const { config } = req.body; // Expects an object mapping doc_id -> requirement, or array of docs

    await connection.beginTransaction();

    // Full replace strategy: Clear existing
    await connection.query('DELETE FROM cm_fund_category_document_config WHERE category_id = ?', [id]);

    // Insert new
    if (config && typeof config === 'object') {
      let sortOrder = 1;
      for (const [docId, requirement] of Object.entries(config)) {
        await connection.query(
          'INSERT INTO cm_fund_category_document_config (category_id, doc_id, requirement, sort_order) VALUES (?, ?, ?, ?)',
          [id, docId, requirement, sortOrder++]
        );
      }
    }

    await connection.commit();
    res.json({ message: 'Category configuration saved successfully' });
  } catch (err) {
    await connection.rollback();
    console.error('Error in saveCategoryConfig:', err);
    res.status(500).json({ error: 'Failed to save category config' });
  } finally {
    connection.release();
  }
};

export const addDocToCategory = async (req, res) => {
  try {
    const categoryId = req.params.id || req.params.categoryId;
    const { docId, requirement, sortOrder } = req.body;

    if (!docId) return res.status(400).json({ error: 'docId is required' });

    await pool.query(
      `INSERT INTO cm_fund_category_document_config (category_id, doc_id, requirement, sort_order) 
       VALUES (?, ?, ?, ?)
       ON DUPLICATE KEY UPDATE requirement = VALUES(requirement), sort_order = VALUES(sort_order)`,
      [categoryId, docId, requirement || 'Optional', sortOrder || 0]
    );

    res.json({ message: 'Document added to category successfully' });
  } catch (err) {
    console.error('Error in addDocToCategory:', err);
    res.status(500).json({ error: 'Failed to add document to category' });
  }
};

export const removeDocFromCategory = async (req, res) => {
  try {
    const { categoryId, docId } = req.params;

    await pool.query(
      `DELETE FROM cm_fund_category_document_config WHERE category_id = ? AND doc_id = ?`,
      [categoryId, docId]
    );

    res.json({ message: 'Document removed from category successfully' });
  } catch (err) {
    console.error('Error in removeDocFromCategory:', err);
    res.status(500).json({ error: 'Failed to remove document from category' });
  }
};

export const toggleDocRequirement = async (req, res) => {
  try {
    const { categoryId, docId } = req.params;
    const { requirement } = req.body;

    if (!requirement) return res.status(400).json({ error: 'requirement is required' });

    await pool.query(
      `UPDATE cm_fund_category_document_config SET requirement = ? WHERE category_id = ? AND doc_id = ?`,
      [requirement, categoryId, docId]
    );

    res.json({ message: 'Document requirement updated successfully' });
  } catch (err) {
    console.error('Error in toggleDocRequirement:', err);
    res.status(500).json({ error: 'Failed to update document requirement' });
  }
};
