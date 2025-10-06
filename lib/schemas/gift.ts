// lib/schemas/gift.ts
import { z } from 'zod'

/** Styles autorisés pour le certificat */
export const AllowedStyles = [
  'neutral',
  'romantic',
  'birthday',
  'wedding',
  'birth',
  'christmas',
  'newyear',
  'graduation',
  'custom',
] as const
export type AllowedStyle = typeof AllowedStyles[number]

/** Modes d’affichage de l’heure sur le certificat */
export const TimeDisplayEnum = z.enum(['utc', 'utc+local', 'local+utc'])
export type TimeDisplay = z.infer<typeof TimeDisplayEnum>

/* ---------------------------------------------
 * 1) REDEEM — Création d’un claim depuis un gift code
 * ------------------------------------------- */

/** Requête de /api/gift/redeem */
export const GiftRedeemRequestSchema = z.object({
  /** Code cadeau (en clair, non hashé) */
  code: z.string().min(6).max(256),

  /** Jour revendiqué, "YYYY-MM-DD" ou ISO; normalisé à minuit UTC côté serveur */
  ts: z.string().min(10),

  /** Email du bénéficiaire */
  email: z.string().email(),

  /** Nom d’affichage (facultatif) */
  display_name: z.string().min(1).max(80).optional().nullable(),

  // Métadonnées facultatives du certificat
  title: z.string().min(1).max(160).optional().nullable(),
  message: z.string().min(1).max(2000).optional().nullable(),

  /**
   * Lien optionnel (chaîne vide autorisée pour “pas de lien”).
   * Évite les validations en double `.optional().or(...)`.
   */
  link_url: z.union([z.string().url().max(512), z.literal('')]).optional(),

  cert_style: z.enum(AllowedStyles).optional().default('neutral'),
  time_display: TimeDisplayEnum.optional().default('local+utc'),
  local_date_only: z.boolean().optional().default(false),
  text_color: z.string().regex(/^#[0-9a-fA-F]{6}$/).optional().default('#1a1f2a'),

  // Visibilité & langue
  title_public: z.boolean().optional().default(false),
  message_public: z.boolean().optional().default(false),
  public_registry: z.boolean().optional().default(false),

  locale: z.enum(['fr', 'en']).optional().default('en'),
})
export type GiftRedeemRequest = z.infer<typeof GiftRedeemRequestSchema>

export const GiftRedeemResponseSchema = z
  .object({
    ok: z.literal(true),
    /** ex: "2025-10-05" */
    ymd: z.string(),
    /** ex: "/fr/m/2025-10-05" */
    claim_url: z.string(),
    /** ex: "/api/cert/2025-10-05" */
    pdf_url: z.string(),
  })
  .or(
    z.object({
      ok: z.literal(false),
      code: z.enum([
        'invalid_code',   // code introuvable
        'disabled_code',  // code désactivé
        'exhausted_code', // plus d’usages
        'bad_ts',         // ts non valide
        'already_claimed',// la journée est déjà revendiquée
        'server_error',   // autre
      ]),
      message: z.string(),
    })
  )
export type GiftRedeemResponse = z.infer<typeof GiftRedeemResponseSchema>

/* ---------------------------------------------
 * 2) TRANSFER — Transfert de propriété A ➜ B
 * ------------------------------------------- */

/** Requête de /api/claim/transfer */
export const ClaimTransferRequestSchema = z.object({
  /** ID du claim (certificat) à transférer */
  claim_id: z.string().uuid(),

  /** Empreinte SHA-256 hexadécimale (64 chars) du certificat à vérifier */
  cert_hash: z.string().length(64).regex(/^[0-9a-f]+$/i),

  /** Code à usage unique (5 caractères alphanumériques, majuscules) */
  code: z.string().length(5).regex(/^[A-Z0-9]{5}$/),

  /** Langue pour redirection/UX */
  locale: z.enum(['fr', 'en']).optional().default('en'),
})
export type ClaimTransferRequest = z.infer<typeof ClaimTransferRequestSchema>

export const ClaimTransferResponseSchema = z
  .object({
    ok: z.literal(true),
    /** URL vers la page compte du nouveau propriétaire */
    account_url: z.string(),
  })
  .or(
    z.object({
      ok: z.literal(false),
      code: z.enum([
        'unauthorized', // B non connecté
        'not_found',    // claim introuvable ou mauvais hash
        'invalid_code', // code 5 chars incorrect
        'already_used', // jeton déjà utilisé
        'revoked',      // jeton révoqué
        'server_error', // autre
      ]),
      message: z.string(),
    })
  )
export type ClaimTransferResponse = z.infer<typeof ClaimTransferResponseSchema>
