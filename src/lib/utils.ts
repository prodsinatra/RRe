export const getStatusColor = (state: string) => {
  switch (state) {
    case 'draft':
    case 'archived':
    case 'cancelled':
      return 'neutral';
    case 'collecting':
    case 'needs_review':
      return 'warning';
    case 'ready_for_checks':
    case 'checks_running':
      return 'processing';
    case 'blocked':
      return 'danger';
    case 'ready_for_approval':
    case 'approved':
    case 'manifest_generated':
      return 'success';
    default:
      return 'neutral';
  }
};

export const getSeverityColor = (severity: string) => {
  switch (severity) {
    case 'blocked':
      return 'danger';
    case 'needs_review':
      return 'warning';
    case 'advisory':
      return 'neutral';
    case 'passed':
      return 'success';
    default:
      return 'neutral';
  }
};

export const formatBytes = (bytes: number, decimals = 2) => {
    if (!+bytes) return '0 Bytes'

    const k = 1024
    const dm = decimals < 0 ? 0 : decimals
    const sizes = ['Bytes', 'KiB', 'MB', 'GB', 'TB', 'PB', 'EB', 'ZB', 'YB']

    const i = Math.floor(Math.log(bytes) / Math.log(k))

    return `${parseFloat((bytes / Math.pow(k, i)).toFixed(dm))} ${sizes[i]}`
}
