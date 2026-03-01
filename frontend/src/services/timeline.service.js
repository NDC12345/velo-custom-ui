import api from './api';

/**
 * Timeline Service
 * Manages timeline viewing and annotation
 */

/**
 * Get timeline data
 * @param {Object} params - Timeline query parameters
 * @param {string} params.notebook_id - Notebook ID for timeline
 * @param {number} params.start_time - Start timestamp
 * @param {number} params.end_time - End timestamp
 * @param {string} params.timeline_id - Timeline ID
 * @returns {Promise<Object>} Timeline data
 */
export const getTimeline = async (params) => {
  const response = await api.post('/api/timelines', params);
  return response.data;
};

/**
 * Annotate timeline
 * @param {Object} annotation - Annotation data
 * @param {string} annotation.notebook_id - Notebook ID
 * @param {string} annotation.timeline_id - Timeline ID
 * @param {number} annotation.timestamp - Timestamp to annotate
 * @param {string} annotation.message - Annotation message
 * @param {string} annotation.type - Annotation type (info, warning, error, etc.)
 * @returns {Promise<Object>} Result
 */
export const annotateTimeline = async (annotation) => {
  const response = await api.post('/api/timelines/annotate', annotation);
  return response.data;
};

/**
 * Get timeline annotations
 * @param {string} timelineId - Timeline ID
 * @returns {Promise<Array>} Annotations
 */
export const getTimelineAnnotations = async (timelineId) => {
  const response = await api.get(`/api/timelines/${timelineId}/annotations`);
  return response.data;
};

/**
 * Delete timeline annotation
 * @param {string} timelineId - Timeline ID
 * @param {string} annotationId - Annotation ID
 * @returns {Promise<void>}
 */
export const deleteTimelineAnnotation = async (timelineId, annotationId) => {
  const response = await api.delete(`/api/timelines/${timelineId}/annotations/${annotationId}`);
  return response.data;
};

export default {
  getTimeline,
  annotateTimeline,
  getTimelineAnnotations,
  deleteTimelineAnnotation,
};
