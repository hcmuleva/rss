/**
 * =====================================================================
 * Services Controller
 * Company: emeelan
 * =====================================================================
 */

const Service = require('../models/Service');
const Subscription = require('../models/Subscription');

/**
 * @route   GET /api/services
 * @desc    Get all active services
 * @access  Public
 */
const getAllServices = async (req, res) => {
  try {
    const services = await Service.findAll();
    
    // If user is logged in, check their subscriptions
    let userSubscriptions = [];
    if (req.user) {
      userSubscriptions = await Subscription.findByUserId(req.user.id);
    }

    // Add isSubscribed flag to each service
    const servicesWithStatus = services.map(service => ({
      ...service,
      features: typeof service.features === 'string' ? JSON.parse(service.features) : service.features,
      isSubscribed: service.slug === 'family-tree' || service.slug === 'temple'
        ? true 
        : userSubscriptions.some(sub => sub.service_id === service.id)
    }));

    res.status(200).json({
      success: true,
      data: {
        services: servicesWithStatus,
        total: services.length
      }
    });
  } catch (error) {
    console.error('Get services error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to get services'
    });
  }
};

/**
 * @route   GET /api/services/:slug
 * @desc    Get service by slug
 * @access  Public
 */
const getServiceBySlug = async (req, res) => {
  try {
    const { slug } = req.params;
    const service = await Service.findBySlug(slug);

    if (!service) {
      return res.status(404).json({
        success: false,
        message: 'Service not found'
      });
    }

    // Parse features if string
    if (typeof service.features === 'string') {
      service.features = JSON.parse(service.features);
    }

    // Check if user is subscribed
    let isSubscribed = false;
    if (req.user) {
      if (slug === 'family-tree' || slug === 'temple') {
        isSubscribed = true;
      } else {
        isSubscribed = await Subscription.hasSubscription(req.user.id, service.id);
      }
    }

    res.status(200).json({
      success: true,
      data: {
        service: {
          ...service,
          isSubscribed
        }
      }
    });
  } catch (error) {
    console.error('Get service error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to get service'
    });
  }
};

/**
 * @route   GET /api/services/category/:category
 * @desc    Get services by category (premium or free)
 * @access  Public
 */
const getServicesByCategory = async (req, res) => {
  try {
    const { category } = req.params;
    const services = await Service.findByCategory(category);

    const servicesWithFeatures = services.map(service => ({
      ...service,
      features: typeof service.features === 'string' ? JSON.parse(service.features) : service.features
    }));

    res.status(200).json({
      success: true,
      data: {
        services: servicesWithFeatures,
        category,
        total: services.length
      }
    });
  } catch (error) {
    console.error('Get services by category error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to get services'
    });
  }
};

module.exports = {
  getAllServices,
  getServiceBySlug,
  getServicesByCategory
};
