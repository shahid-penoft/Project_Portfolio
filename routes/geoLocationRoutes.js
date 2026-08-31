import express from 'express';
import { verifyToken, optionalVerifyToken, requirePermission } from '../middlewares/auth.js';
import { verifyConstituentToken } from '../middlewares/constituentAuth.js';
import * as ctrl from '../controllers/geoLocationController.js';

const router = express.Router();

// Public read endpoints
router.get('/stats', ctrl.getGeoLocationStats);
router.get('/map-data', ctrl.getGeoLocationMapData);

// Constituent specific endpoints (bookmarks)
// Must be defined before /:id to avoid being caught by the wildcard
router.get('/my-bookmarks', verifyConstituentToken, ctrl.getMyBookmarks);

router.get('/:id', optionalVerifyToken, ctrl.getGeoLocationById);
router.get('/', optionalVerifyToken, ctrl.getAllGeoLocations);

router.post('/:id/bookmark', verifyConstituentToken, ctrl.toggleBookmark);

// Admin only endpoints
router.post('/:id/admin-bookmark', verifyToken, ctrl.toggleAdminBookmark);
router.post('/', verifyToken, requirePermission(['geo_mapping', 'geo-location', 'site_settings']), ctrl.createGeoLocation);
router.put('/:id', verifyToken, requirePermission(['geo_mapping', 'geo-location', 'site_settings']), ctrl.updateGeoLocation);
router.post('/:id/upload-media', verifyToken, requirePermission(['geo_mapping', 'geo-location', 'site_settings']), ctrl.uploadGeoLocationMediaHandler);
router.post('/:id/upload-attachment', verifyToken, requirePermission(['geo_mapping', 'geo-location', 'site_settings']), ctrl.uploadGeoLocationAttachmentHandler);
router.delete('/:id', verifyToken, requirePermission(['geo_mapping', 'geo-location', 'site_settings']), ctrl.deleteGeoLocation);

export default router;
