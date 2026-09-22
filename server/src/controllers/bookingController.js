import Joi from 'joi';
import { Booking } from '../models/Booking.js';

// Validation for creating a booking
const createBookingSchema = Joi.object({
  roomNumber: Joi.string().required(),
  startDate: Joi.date().required(),
  endDate: Joi.date().greater(Joi.ref('startDate')).required(),
  purpose: Joi.string().optional(),
  bookedBy: Joi.string().optional()
});

// Validation for updating a booking
const updateBookingSchema = Joi.object({
  roomNumber: Joi.string().optional(),
  startDate: Joi.date().optional(),
  endDate: Joi.date().optional(),
  purpose: Joi.string().optional(),
  bookedBy: Joi.string().optional()
});


// Check whether a proposed booking overlaps another booking
async function hasConflict(roomNumber, startDate, endDate, excludeId = null) {
  const query = {
    roomNumber,
    startDate: { $lt: endDate },
    endDate: { $gt: startDate }
  };

  // When updating, don't compare the booking with itself
  if (excludeId) {
    query._id = { $ne: excludeId };
  }

  const conflict = await Booking.findOne(query);

  return !!conflict;
}


// GET /api/bookings
export async function getAllBookings(req, res, next) {
  try {
    const bookings = await Booking.find()
      .sort({ createdAt: -1 });

    res.json({ bookings });
  } catch (err) {
    next(err);
  }
}


// GET /api/bookings/:id
export async function getBooking(req, res, next) {
  try {
    const booking = await Booking.findById(req.params.id);

    if (!booking) {
      return res.status(404).json({ message: 'Booking not found' });
    }

    res.json({ booking });
  } catch (err) {
    next(err);
  }
}


// POST /api/bookings
export async function createBooking(req, res, next) {
  try {
    const { value, error } = createBookingSchema.validate(req.body);

    if (error) {
      return res.status(400).json({ message: error.message });
    }

    const conflict = await hasConflict(
      value.roomNumber,
      value.startDate,
      value.endDate
    );

    if (conflict) {
      return res.status(409).json({
        message: 'Booking conflicts with an existing booking'
      });
    }

    const booking = await Booking.create(value);

    res.status(201).json({ booking });
  } catch (err) {
    next(err);
  }
}


// PATCH /api/bookings/:id
export async function updateBooking(req, res, next) {
  try {
    const { value, error } = updateBookingSchema.validate(req.body, {
      abortEarly: false,
      stripUnknown: true
    });

    if (error) {
      return res.status(400).json({ message: error.message });
    }

    // We need the existing booking because PATCH may contain
    // only some of the fields.
    const existing = await Booking.findById(req.params.id);

    if (!existing) {
      return res.status(404).json({ message: 'Booking not found' });
    }

    // Combine existing values with the fields being updated.
    const roomNumber = value.roomNumber ?? existing.roomNumber;
    const startDate = value.startDate ?? existing.startDate;
    const endDate = value.endDate ?? existing.endDate;

    // Explicitly check startDate < endDate after combining
    // the existing booking with the PATCH data.
    if (new Date(startDate) >= new Date(endDate)) {
      return res.status(400).json({
        message: 'startDate must be strictly before endDate'
      });
    }

    const conflict = await hasConflict(
      roomNumber,
      startDate,
      endDate,
      existing._id
    );

    if (conflict) {
      return res.status(409).json({
        message: 'Booking conflicts with an existing booking'
      });
    }

    const booking = await Booking.findByIdAndUpdate(
      req.params.id,
      { $set: value },
      { new: true, runValidators: true }
    );

    res.json({ booking });
  } catch (err) {
    next(err);
  }
}


// DELETE /api/bookings/:id
export async function deleteBooking(req, res, next) {
  try {
    const booking = await Booking.findByIdAndDelete(req.params.id);

    if (!booking) {
      return res.status(404).json({ message: 'Booking not found' });
    }

    res.json({ ok: true });
  } catch (err) {
    next(err);
  }
}