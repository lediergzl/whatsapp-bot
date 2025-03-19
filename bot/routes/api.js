
const express = require('express');
const router = express.Router();
const db = require('../database.js');

// GET /api/subscribers
router.get('/subscribers', async (req, res) => {
    try {
        const subscribers = await db.queryDb('SELECT * FROM subscriptions ORDER BY created_at DESC');
        res.json(subscribers);
    } catch (err) {
        res.status(500).json({ error: 'Error obteniendo suscriptores' });
    }
});

// POST /api/subscribers
router.post('/subscribers', async (req, res) => {
    const { name, phone, publicar_grupo } = req.body;
    try {
        await db.queryDb(
            'INSERT INTO subscriptions (name, phone, publicar_grupo) VALUES (?, ?, ?)',
            [name, phone, publicar_grupo ? 1 : 0]
        );
        res.json({ success: true });
    } catch (err) {
        res.status(500).json({ error: 'Error creando suscriptor' });
    }
});

// GET /api/groups
router.get('/groups', async (req, res) => {
    try {
        const groups = await db.queryDb('SELECT * FROM groups');
        res.json(groups);
    } catch (err) {
        res.status(500).json({ error: 'Error obteniendo grupos' });
    }
});

module.exports = router;
