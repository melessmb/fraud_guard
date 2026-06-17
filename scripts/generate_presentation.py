from fpdf import FPDF
from pathlib import Path

OUTPUT = Path("presentation_fraud_detection_v2.pdf")

class PDF(FPDF):
    def header(self):
        if self.page_no() > 1:
            self.set_font("Helvetica", "I", 8)
            self.set_text_color(120, 120, 120)
            self.cell(0, 6, "Fraud Detection Ouest-Afrique · Document de présentation", align="C")
            self.ln(8)

    def footer(self):
        self.set_y(-15)
        self.set_font("Helvetica", "I", 8)
        self.set_text_color(120, 120, 120)
        self.cell(0, 10, f"Page {self.page_no()}", align="C")

    def section_title(self, title: str):
        self.set_font("Helvetica", "B", 13)
        self.set_text_color(20, 20, 20)
        self.cell(0, 10, title, new_x="LMARGIN", new_y="NEXT", align="L")
        self.set_draw_color(180, 180, 180)
        self.line(10, self.get_y(), 200, self.get_y())
        self.ln(3)

    def body_text(self, text: str):
        self.set_font("Helvetica", "", 11)
        self.set_text_color(30, 30, 30)
        self.multi_cell(0, 6, text)
        self.ln(2)

    def bullet(self, text: str):
        self.set_font("Helvetica", "", 11)
        self.set_text_color(30, 30, 30)
        self.cell(6)
        self.cell(6, 6, chr(149), new_x="RIGHT", new_y="TOP")
        self.multi_cell(0, 6, text)
        self.ln(1)

pdf = PDF()
pdf.set_auto_page_break(auto=True, margin=18)

# Page 1 : titre
pdf.add_page()
pdf.set_font("Helvetica", "B", 22)
pdf.set_y(90)
pdf.cell(0, 14, "Fraud Detection Ouest-Afrique", align="C", new_x="LMARGIN", new_y="NEXT")
pdf.set_font("Helvetica", "", 14)
pdf.cell(0, 10, "Détection de fraude en temps réel pour banques, assurances et opérateurs de mobile money", align="C", new_x="LMARGIN", new_y="NEXT")
pdf.set_font("Helvetica", "I", 12)
pdf.set_y(135)
pdf.cell(0, 10, "Document de présentation · Client & Conformité", align="C", new_x="LMARGIN", new_y="NEXT")
pdf.set_y(150)
pdf.set_font("Helvetica", "", 11)
pdf.cell(0, 8, "Cible : Côte d'Ivoire, Sénégal", align="C", new_x="LMARGIN", new_y="NEXT")
pdf.cell(0, 8, "Date : juin 2026", align="C", new_x="LMARGIN", new_y="NEXT")

# Page 2 : sommaire
pdf.add_page()
pdf.section_title("Sommaire")
pdf.bullet("Contexte et enjeux")
pdf.bullet("Problématique")
pdf.bullet("Solution proposée")
pdf.bullet("Sécurité et conformité")
pdf.bullet("Modèle économique")
pdf.bullet("Roadmap")
pdf.bullet("Équipe et partenaires")
pdf.bullet("Points de conformité clés")
pdf.bullet("Contact et prochaines étapes")

# Page 3 : contexte
pdf.add_page()
pdf.section_title("1. Contexte et enjeux")
pdf.body_text(
    "Le secteur financier ouest-africain connaît une accélération numérique forte : "
    "paiements mobiles, néobanques, expansion des réseaux agents. Cette dynamique génère "
    "des volumes de transactions en forte croissance, mais aussi une recrudescence de la fraude : "
    "usurpation d'identité, rejets abusifs, arnaques psychologiques, blanchiment."
)
pdf.body_text(
    "Les banques et assureurs font face à trois difficultés majeures :"
)
pdf.bullet("Des systèmes de détection vieillissants, peu adaptés aux spécificités locales.")
pdf.bullet("Des coûts élevés liés aux faux positifs et aux pertes non détectées.")
pdf.bullet("Un cadre réglementaire de plus en plus strict (BCEAO, CNIL ouest-africaines).")
pdf.body_text("Nous proposons une plateforme spécialisée pour répondre à ces défis.")

# Page 4 : problématique
pdf.add_page()
pdf.section_title("2. Problématique client")
pdf.body_text("Notre objectif est de résoudre un problème précis :")
pdf.bullet("Détecter la fraude en temps réel sur les transactions et le mobile money.")
pdf.bullet("Réduire les pertes financières tout en limitant les faux positifs.")
pdf.bullet("Respecter les contraintes de souveraineté et de conformité locales.")
pdf.body_text("Priorisation du périmètre initial :")
pdf.bullet("Géographie : Côte d'Ivoire et Sénégal")
pdf.bullet("Institutions cibles : banques, fintechs, opérateurs mobile money")
pdf.bullet("Canal prioritaire : transactions mobile money / virements")
pdf.bullet("Typologie de fraude prioritaire : comptes compromis et usurpation d'identité")

# Page 5 : solution
pdf.add_page()
pdf.section_title("4. Solution proposée")
pdf.body_text("Une plateforme SaaS / API régionalisée qui expose un moteur de notation en temps réel, intégrable en quelques jours.")
pdf.bullet("API dédiée : notation de chaque transaction avec une latence adaptée aux besoins opérationnels.")
pdf.bullet("Interfaçable avec les SI existants via un mécanisme d'appel standard.")
pdf.bullet("Modèle IA explicable : chaque décision peut être justifiée pour les audits et les régulateurs.")
pdf.bullet("Tableaux de bord opérationnels pour les équipes risque et conformité.")
pdf.bullet("Isolation garantie entre clients et chiffrement des données sensibles.")
pdf.body_text("Livraison en trois phases : prototype, PoC client, industrialisation.")

# Page 6 : fonctionnement du système
pdf.add_page()
pdf.section_title("5. Fonctionnement du système")
pdf.body_text(
    "Le système est conçu pour être intégré simplement aux environnements existants des institutions financières, "
    "sans perturber leurs opérations courantes."
)
pdf.body_text("Acteurs et flux :")
pdf.bullet("Le Système d'Information du client envoie une transaction au moteur de notation via un appel standard.")
pdf.bullet("Le moteur analyse la transaction et renvoie un score et un niveau de risque en temps réel.")
pdf.bullet("Les équipes risque et conformité consultent les tableaux de bord pour suivre les alertes et les performances.")
pdf.body_text("Données analysées (sans données biométriques) :")
pdf.bullet("Caractéristiques de la transaction : montant, devise, canal, heure, pays.")
pdf.bullet("Contexte de l'appareil et du réseau : empreinte appareil, adresse IP.")
pdf.bullet("Historique comportemental du client sur la plateforme.")
pdf.body_text("Sortie produite :")
pdf.bullet("Un score de risque et un indicateur de détection de fraude.")
pdf.bullet("Des éléments d'explication associés à chaque décision, pour les audits et les régulateurs.")
pdf.bullet("Une traçabilité complète horodatée et associée à la transaction.")
pdf.body_text("Engagement de performance : réponse adaptée aux exigences opérationnelles des métiers.")

# Page 7 : sécurité conformité
pdf.add_page()
pdf.section_title("6. Sécurité et conformité")
pdf.body_text("Ce volet est structurant pour l'équipe de conformité et les auditeurs.")
pdf.bullet("Hébergement des données en Afrique de l'Ouest, avec isolation par pays.")
pdf.bullet("Chiffrement en transit et au repos pour les données sensibles.")
pdf.bullet("Traçabilité complète : logs immuables des décisions, export d'explications par transaction.")
pdf.bullet("Isolation entre clients avec mécanismes d'authentification distincts.")
pdf.bullet("Conformité dès la conception : droits d'accès, auditabilité, conformité BCEAO et CNIL.")
pdf.bullet("Feuille de route vers ISO 27001 et/ou SOC 2 pour les clients qui le nécessitent.")
pdf.body_text("Aucun transfert hors périmètre autorisé sans accord explicite du client.")

# Page 8 : modèle économique
pdf.add_page()
pdf.section_title("7. Modèle économique")
pdf.body_text("Deux composantes pour aligner la rémunération sur la valeur délivrée.")
pdf.bullet("Frais d'intégration / setup : mise en place des connecteurs, onboarding, ajustements.")
pdf.bullet("Abonnement mensuel variable selon le volume de transactions traitées.")
pdf.body_text("Option complémentaire :")
pdf.bullet("Facturation à la transaction au-delà d'un certain volume.")
pdf.bullet("Support et professional services : ajustements, accompagnement conformité.")
pdf.body_text("Politique de prix : conditions préférentielles pour les premiers clients références.")

# Page 8 : roadmap
pdf.add_page()
pdf.section_title("6. Roadmap")
pdf.section_title("Phase 1 · Prototype et validation (0 à 3 mois)")
pdf.bullet("MVP opérationnel : API, mécanismes d'authentification, modèle fonctionnel.")
pdf.bullet("2 PoC clients signés (banque + opérateur mobile money).")
pdf.bullet("Collecte de données réelles et calibration initiale.")

pdf.section_title("Phase 2 · Industrialisation (3 à 6 mois)")
pdf.bullet("Modèle entraîné sur données locales, avec capacités d'explication.")
pdf.bullet("Tests de charge et renforcement de la supervision.")
pdf.bullet("Renforcement de la conformité (logs, audit, procédures).")

pdf.section_title("Phase 3 · Expansion (6 à 12 mois)")
pdf.bullet("Nouveaux pays (Mali, Burkina Faso, Niger).")
pdf.bullet("Certifications ISO 27001 / SOC 2.")
pdf.bullet("Extensions modulaires : scoring crédit, détection de blanchiment.")

# Page 9 : équipe
pdf.add_page()
pdf.section_title("7. Équipe")
pdf.bullet("Fondateur tech / data science : responsable architecture produit et modèles.")
pdf.bullet("Responsable conformité : connaissance du secteur bancaire africain et des exigences réglementaires.")
pdf.bullet("Accompagnement à prévoir : ingénieur DevOps, expert sécurité, chef de projet déploiement.")

# Page 10 : conformité détaillée
pdf.add_page()
pdf.section_title("8. Points de conformité clés")
pdf.bullet("Base légale : conformité aux directives BCEAO en matière de lutte contre la fraude et le blanchiment.")
pdf.bullet("Données personnelles : enregistrement des traitements, limitation des finalités, droit d'accès et d'oubli.")
pdf.bullet("Sécurité opérationnelle : revue de code, tests d'intrusion, gestion des incidents.")
pdf.bullet("Gouvernance : comité de pilotage sécurité, politique de sauvegarde, sauvegarde chiffrée.")
pdf.bullet("Sous-traitance : documentation des hébergeurs et fournisseurs cloud, clauses contractuelles adaptées.")
pdf.body_text("Un plan de conformité détaillé peut être fourni sur demande.")

# Page 11 : contact
pdf.add_page()
pdf.section_title("9. Contact et prochaines étapes")
pdf.body_text("Pour toute demande de démonstration, d'évaluation ou de contractualisation, merci de nous contacter.")
pdf.bullet("Objet : Demande de présentation Fraud Detection Ouest-Afrique")
pdf.bullet("Livrables possibles : démo live, preuve de concept encadrée, réponse à appel d'offres")
pdf.bullet("Délai de réponse : sous 48 heures")
pdf.ln(8)
pdf.set_font("Helvetica", "I", 11)
pdf.cell(0, 10, "Document généré en juin 2026 · Version 1.0", align="C", new_x="LMARGIN", new_y="NEXT")

OUTPUT.parent.mkdir(parents=True, exist_ok=True)
pdf.output(str(OUTPUT))
print(f"PDF genere : {OUTPUT}")
