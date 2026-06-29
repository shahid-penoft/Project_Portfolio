import { Router } from 'express';
import { verifyToken, requirePermission } from '../middlewares/auth.js';
import {
    getCampaigns,
    getCampaignById,
    createCampaign,
    updateCampaign,
    deleteCampaign,
    launchCampaign,
} from '../controllers/campaignController.js';

const router = Router();

// All campaign routes require authentication
router.use(verifyToken, requirePermission('enquiries'));

router.get('/', getCampaigns);
router.get('/:id', getCampaignById);
router.post('/', createCampaign);
router.put('/:id', updateCampaign);
router.delete('/:id', deleteCampaign);
router.post('/:id/launch', launchCampaign);

export default router;
