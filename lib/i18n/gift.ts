//app/lib/i18n/gift.ts
export const giftRedeemI18n = {
    fr: {
      title: 'Récupérer un cadeau',
      subtitle: 'Entrez votre code cadeau et choisissez la journée à revendiquer.',
      fields: {
        code: { label: 'Code cadeau', placeholder: 'Ex. KAMIAM-8F3D2A' },
        ts: { label: 'Jour', help: 'Format AAAA-MM-JJ (UTC)' },
        email: { label: 'Votre e-mail' },
        display_name: { label: 'Nom affiché (optionnel)' },
        title: { label: 'Titre (optionnel)' },
        message: { label: 'Message (optionnel)' },
        link_url: { label: 'Lien (optionnel)' },
        cert_style: { label: 'Style du certificat' },
        time_display: { label: 'Affichage de l’heure' },
        local_date_only: { label: 'Afficher seulement la date locale' },
        text_color: { label: 'Couleur du texte (hex)' },
        public_registry: { label: 'Publier dans le registre public' },
      },
      cta: 'Récupérer',
      done: {
        title: 'Cadeau récupéré 🎉',
        body: 'Votre certificat est prêt. Vous pouvez l’ouvrir ou télécharger le PDF.',
        openCertificate: 'Ouvrir le certificat',
        downloadPdf: 'Télécharger le PDF'
      },
      errors: {
        invalid_code: 'Ce code est introuvable.',
        disabled_code: 'Ce code a été désactivé.',
        exhausted_code: 'Ce code a déjà été utilisé au maximum.',
        bad_ts: 'La date est invalide.',
        already_claimed: 'Cette journée est déjà revendiquée.',
        server_error: 'Erreur serveur. Réessayez.'
      },
      trust: 'Paiement non requis — cadeau déjà réglé.',
    },
    en: {
      title: 'Redeem a gift',
      subtitle: 'Enter your gift code and choose the day you want to claim.',
      fields: {
        code: { label: 'Gift code', placeholder: 'e.g. KAMIAM-8F3D2A' },
        ts: { label: 'Day', help: 'Format YYYY-MM-DD (UTC)' },
        email: { label: 'Your email' },
        display_name: { label: 'Display name (optional)' },
        title: { label: 'Title (optional)' },
        message: { label: 'Message (optional)' },
        link_url: { label: 'Link (optional)' },
        cert_style: { label: 'Certificate style' },
        time_display: { label: 'Time display' },
        local_date_only: { label: 'Show local date only' },
        text_color: { label: 'Text color (hex)' },
        public_registry: { label: 'Publish to the public registry' },
      },
      cta: 'Redeem',
      done: {
        title: 'Gift redeemed 🎉',
        body: 'Your certificate is ready. You can open it or download the PDF.',
        openCertificate: 'Open certificate',
        downloadPdf: 'Download PDF'
      },
      errors: {
        invalid_code: 'This code was not found.',
        disabled_code: 'This code has been disabled.',
        exhausted_code: 'This code has reached its usage limit.',
        bad_ts: 'The date is invalid.',
        already_claimed: 'This day has already been claimed.',
        server_error: 'Server error. Please try again.'
      },
      trust: 'No payment required — this gift is prepaid.',
    }
  }

  export type GiftRedeemDict = typeof giftRedeemI18n['en'] // aide de type si besoin
  