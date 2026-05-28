import React from 'react';

/**
 * Redacciones AI page.
 *
 * The actual iframe is rendered persistently at the AdminLayout level
 * (see PersistentRedactoraIframe.js) so it survives navigation between
 * admin pages. This component is only a placeholder occupying the
 * viewport; the iframe layer above shows/hides based on the route.
 */
const ProposalPage = () => {
  return (
    <div style={{ height: 'calc(100vh - 70px - 48px)', width: '100%' }} />
  );
};

export default ProposalPage;
