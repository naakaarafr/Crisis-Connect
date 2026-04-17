class SecondaryRiskModel:
    """
    Rule-based / heuristic secondary risk scorer.
    Returns structured risk metrics from displaced-population stats.
    """

    HIGH_RISK_TYPES = {
        "epidemic", "chemical spill", "radiation leak", "nuclear accident"
    }

    def predict(self, data: dict) -> dict:
        """
        Parameters (all optional with safe defaults)
        ----------
        data keys:
            displaced_people  : int   — number of displaced persons
            severity          : float — disaster severity 1-10
            disaster_type     : str   — e.g. 'flood', 'epidemic'

        Returns
        -------
        dict: risk_score, category, disease_risk, overcrowding, food_shortage, level
        """
        displaced = int(data.get("displaced_people", 0))
        severity = float(data.get("severity", 0.0))
        disaster_type = str(data.get("disaster_type", "default")).lower().strip()

        displacement_factor = displaced / 10_000.0
        base_score = int(severity + displacement_factor)

        if disaster_type in self.HIGH_RISK_TYPES:
            base_score += 2

        risk_score = max(0, base_score)

        if risk_score >= 12 or displaced > 80_000:
            category = "critical"
            level = "high"
        elif risk_score >= 7 or displaced > 30_000:
            category = "high"
            level = "high"
        else:
            category = "moderate"
            level = "low"

        if category == "critical" or disaster_type in {"epidemic", "chemical spill"}:
            disease_risk = "high"
        elif category == "high" or displaced > 20_000:
            disease_risk = "medium"
        else:
            disease_risk = "low"

        return {
            "risk_score": risk_score,
            "category": category,
            "level": level,
            "disease_risk": disease_risk,
            "overcrowding": displaced > 30_000,
            "food_shortage": category in {"critical", "high"} or displaced > 50_000
        }
