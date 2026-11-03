const express = require('express');
const { protectOwner } = require('../middleware/authMiddleware');
const {
  listTrainerStaff,
  createTrainerStaff,
  updateTrainerStaff,
  deleteTrainerStaff
} = require('../controllers/trainerStaffController');

const router = express.Router();
router.use(protectOwner);
router.get('/', listTrainerStaff);
router.post('/', createTrainerStaff);
router.put('/:id', updateTrainerStaff);
router.delete('/:id', deleteTrainerStaff);

module.exports = router;
