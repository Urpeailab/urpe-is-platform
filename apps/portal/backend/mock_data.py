# Mock eligibility reports for testing

MOCK_USERS = {
    "+15550001": {
        "id": "user-001",
        "phone": "+15550001",
        "name": "John Smith",
        "email": "john.smith@example.com",
        "profession": "Software Engineer",
        "eligible": True,
        "advisor": {
            "name": "Gigliola Bocanegra",
            "photo": "https://api.dicebear.com/7.x/avataaars/svg?seed=Gigliola&backgroundColor=ffc700",
            "title": "Immigration Expert - Founder & CEO"
        },
        "report": {
            "profession": "Software Engineer",
            "userId": "user-001",
            "nationalInterestProject": {
                "title": "reportContent.user001.nationalInterest.title",
                "description": "reportContent.user001.nationalInterest.description",
                "impact": "reportContent.user001.nationalInterest.impact"
            },
            "patent": {
                "title": "reportContent.user001.patent.title",
                "description": "reportContent.user001.patent.description",
                "usptoDraft": "reportContent.user001.patent.usptoDraft"
            },
            "book": {
                "title": "reportContent.user001.book.title",
                "description": "reportContent.user001.book.description",
                "chapters": [
                    "reportContent.user001.book.chapter1",
                    "reportContent.user001.book.chapter2",
                    "reportContent.user001.book.chapter3",
                    "reportContent.user001.book.chapter4",
                    "reportContent.user001.book.chapter5"
                ]
            },
            "mobileApp": {
                "name": "reportContent.user001.mobileApp.name",
                "description": "reportContent.user001.mobileApp.description",
                "features": [
                    "reportContent.user001.mobileApp.feature1",
                    "reportContent.user001.mobileApp.feature2",
                    "reportContent.user001.mobileApp.feature3",
                    "reportContent.user001.mobileApp.feature4",
                    "reportContent.user001.mobileApp.feature5"
                ],
                "platforms": "reportContent.user001.mobileApp.platforms"
            },
            "recommendations": [
                "reportContent.user001.recommendation1",
                "reportContent.user001.recommendation2",
                "reportContent.user001.recommendation3",
                "reportContent.user001.recommendation4",
                "reportContent.user001.recommendation5"
            ],
            "nextSteps": [
                "reportContent.user001.nextStep1",
                "reportContent.user001.nextStep2",
                "reportContent.user001.nextStep3",
                "reportContent.user001.nextStep4"
            ]
        }
    },
    "+15550002": {
        "id": "user-002",
        "phone": "+15550002",
        "name": "Dr. Maria Garcia",
        "email": "maria.garcia@example.com",
        "profession": "Medical Doctor",
        "eligible": True,
        "advisor": {
            "name": "Ana Torres",
            "photo": "https://api.dicebear.com/7.x/avataaars/svg?seed=AnaTorres&backgroundColor=ffc700",
            "title": "Senior Immigration Advisor"
        },
        "report": {
            "profession": "Medical Doctor (Cardiology)",
            "userId": "user-002",
            "nationalInterestProject": {
                "title": "reportContent.user002.nationalInterest.title",
                "description": "reportContent.user002.nationalInterest.description",
                "impact": "reportContent.user002.nationalInterest.impact"
            },
            "patent": {
                "title": "reportContent.user002.patent.title",
                "description": "reportContent.user002.patent.description",
                "usptoDraft": "reportContent.user002.patent.usptoDraft"
            },
            "book": {
                "title": "reportContent.user002.book.title",
                "description": "reportContent.user002.book.description",
                "chapters": [
                    "reportContent.user002.book.chapter1",
                    "reportContent.user002.book.chapter2",
                    "reportContent.user002.book.chapter3",
                    "reportContent.user002.book.chapter4",
                    "reportContent.user002.book.chapter5"
                ]
            },
            "mobileApp": {
                "name": "reportContent.user002.mobileApp.name",
                "description": "reportContent.user002.mobileApp.description",
                "features": [
                    "reportContent.user002.mobileApp.feature1",
                    "reportContent.user002.mobileApp.feature2",
                    "reportContent.user002.mobileApp.feature3",
                    "reportContent.user002.mobileApp.feature4",
                    "reportContent.user002.mobileApp.feature5"
                ],
                "platforms": "reportContent.user002.mobileApp.platforms"
            },
            "recommendations": [
                "reportContent.user002.recommendation1",
                "reportContent.user002.recommendation2",
                "reportContent.user002.recommendation3",
                "reportContent.user002.recommendation4",
                "reportContent.user002.recommendation5"
            ],
            "nextSteps": [
                "reportContent.user002.nextStep1",
                "reportContent.user002.nextStep2",
                "reportContent.user002.nextStep3",
                "reportContent.user002.nextStep4"
            ]
        }
    },
    "+15550003": {
        "id": "user-003",
        "phone": "+15550003",
        "name": "Carlos Rodriguez",
        "email": "carlos.rodriguez@example.com",
        "profession": "Entrepreneur",
        "eligible": True,
        "advisor": {
            "name": "Roberto Silva",
            "photo": "https://api.dicebear.com/7.x/avataaars/svg?seed=RobertoSilva&backgroundColor=ffc700",
            "title": "EB-2 NIW Specialist"
        },
        "report": {
            "profession": "Tech Entrepreneur (Clean Energy)",
            "nationalInterestProject": {
                "title": "Affordable Solar Energy Solutions for Low-Income Housing",
                "description": "Development and deployment of cost-effective solar panel systems specifically designed for multi-family low-income housing units, addressing energy poverty while reducing carbon emissions.",
                "impact": "Project targets installation in 50,000+ low-income housing units across 10 states, reducing energy costs by 60% and creating 500+ green jobs in underserved communities."
            },
            "patent": {
                "title": "Modular Solar Panel System with Integrated Energy Storage for Multi-Unit Buildings",
                "description": "Innovative solar technology that can be easily installed on multi-family buildings without structural modifications, with built-in battery storage optimized for urban environments.",
                "usptoDraft": "Utility patent for modular renewable energy system architecture."
            },
            "book": {
                "title": "Solar for All: Making Clean Energy Accessible",
                "description": "A practical guide for bringing renewable energy to low-income communities, covering technology, financing, policy, and implementation strategies.",
                "chapters": [
                    "The Energy Poverty Crisis in America",
                    "Technology Solutions for Affordable Solar",
                    "Innovative Financing Models",
                    "Navigating Regulations and Incentives",
                    "Building Community Solar Programs",
                    "Creating Green Jobs in Underserved Areas"
                ]
            },
            "mobileApp": {
                "name": "SolarAccess",
                "description": "Platform connecting low-income households with affordable solar solutions, financing options, and real-time energy savings tracking.",
                "features": [
                    "Solar feasibility assessment",
                    "Financing calculator and applications",
                    "Real-time energy production monitoring",
                    "Utility bill comparison and savings tracker",
                    "Community solar marketplace",
                    "Educational resources in multiple languages"
                ],
                "platforms": "iOS, Android, and Web"
            },
            "recommendations": [
                "File provisional patent for modular solar system",
                "Secure pilot program partnerships with housing authorities",
                "Apply for Department of Energy grants",
                "Document job creation and community impact metrics",
                "Develop relationships with state energy offices"
            ],
            "nextSteps": [
                "Compile evidence of successful pilot programs",
                "Gather letters from housing authorities and community leaders",
                "Document environmental and economic impact",
                "Prepare business plan and growth projections"
            ]
        }
    }
}

def translate_report(report, language):
    """Translate report content to specified language"""
    if language != "es":
        return report  # Return as-is for English
    
    # Import Spanish translations
    from mock_data_es import MOCK_REPORTS_ES
    
    # Find the corresponding Spanish report by matching the profession
    phone_map = {
        "Software Engineer": "+15550001",
        "Medical Doctor (Cardiology)": "+15550002",
        "Tech Entrepreneur (Clean Energy)": "+15550003"
    }
    
    phone = phone_map.get(report.get("profession"))
    if phone and phone in MOCK_REPORTS_ES:
        return MOCK_REPORTS_ES[phone]
    
    # Fallback: return original if no translation found
    return report

def get_user_by_phone(phone: str, language: str = "en"):
    """Get mock user data by phone number with language support"""
    user = MOCK_USERS.get(phone)
    if user and "report" in user:
        # Create a copy of user data
        import copy
        user_copy = copy.deepcopy(user)
        user_copy["report"] = translate_report(user["report"], language)
        return user_copy
    return user

def get_all_eligible_phones():
    """Get list of all eligible phone numbers"""
    return list(MOCK_USERS.keys())

# ====== COMPARATOR DATA ======

def get_similar_cases_data(user_id: str):
    """Get mock data for similar cases comparison"""
    
    # Mock similar cases with realistic data
    similar_cases = [
        {
            "id": "case-001",
            "country": "India",
            "profession": "Software Engineer",
            "visaType": "EB-2 NIW",
            "education": "Master's Degree",
            "experience": 8,
            "status": "Approved",
            "processingTime": 14,
            "successRate": 94,
            "profile": {
                "patents": 2,
                "publications": 5,
                "citations": 150,
                "awards": 3
            },
            "timeline": {
                "preparation": 2,
                "submission": 1,
                "uscisReview": 8,
                "rfe": 0,
                "approval": 3
            }
        },
        {
            "id": "case-002",
            "country": "Mexico",
            "profession": "Data Scientist",
            "visaType": "EB-2 NIW",
            "education": "PhD",
            "experience": 6,
            "status": "Approved",
            "processingTime": 11,
            "successRate": 97,
            "profile": {
                "patents": 1,
                "publications": 8,
                "citations": 320,
                "awards": 2
            },
            "timeline": {
                "preparation": 2,
                "submission": 1,
                "uscisReview": 6,
                "rfe": 0,
                "approval": 2
            }
        },
        {
            "id": "case-003",
            "country": "China",
            "profession": "AI Researcher",
            "visaType": "EB-2 NIW",
            "education": "PhD",
            "experience": 10,
            "status": "Approved",
            "processingTime": 16,
            "successRate": 92,
            "profile": {
                "patents": 4,
                "publications": 12,
                "citations": 580,
                "awards": 5
            },
            "timeline": {
                "preparation": 3,
                "submission": 1,
                "uscisReview": 9,
                "rfe": 1,
                "approval": 2
            }
        },
        {
            "id": "case-004",
            "country": "Brazil",
            "profession": "Cybersecurity Expert",
            "visaType": "EB-2 NIW",
            "education": "Master's Degree",
            "experience": 7,
            "status": "Approved",
            "processingTime": 13,
            "successRate": 95,
            "profile": {
                "patents": 1,
                "publications": 4,
                "citations": 85,
                "awards": 2
            },
            "timeline": {
                "preparation": 2,
                "submission": 1,
                "uscisReview": 7,
                "rfe": 1,
                "approval": 2
            }
        },
        {
            "id": "case-005",
            "country": "Philippines",
            "profession": "Healthcare IT Specialist",
            "visaType": "EB-2 NIW",
            "education": "Master's Degree",
            "experience": 9,
            "status": "Approved",
            "processingTime": 12,
            "successRate": 96,
            "profile": {
                "patents": 2,
                "publications": 6,
                "citations": 200,
                "awards": 4
            },
            "timeline": {
                "preparation": 2,
                "submission": 1,
                "uscisReview": 7,
                "rfe": 0,
                "approval": 2
            }
        },
        {
            "id": "case-006",
            "country": "Nigeria",
            "profession": "Renewable Energy Engineer",
            "visaType": "EB-2 NIW",
            "education": "PhD",
            "experience": 11,
            "status": "In Progress",
            "processingTime": 8,
            "successRate": 93,
            "profile": {
                "patents": 3,
                "publications": 9,
                "citations": 410,
                "awards": 3
            },
            "timeline": {
                "preparation": 2,
                "submission": 1,
                "uscisReview": 5,
                "rfe": 0,
                "approval": 0
            }
        },
        {
            "id": "case-007",
            "country": "Colombia",
            "profession": "Biomedical Engineer",
            "visaType": "EB-2 NIW",
            "education": "PhD",
            "experience": 5,
            "status": "Approved",
            "processingTime": 15,
            "successRate": 91,
            "profile": {
                "patents": 2,
                "publications": 7,
                "citations": 265,
                "awards": 2
            },
            "timeline": {
                "preparation": 3,
                "submission": 1,
                "uscisReview": 8,
                "rfe": 1,
                "approval": 2
            }
        },
        {
            "id": "case-008",
            "country": "Vietnam",
            "profession": "Machine Learning Engineer",
            "visaType": "EB-2 NIW",
            "education": "Master's Degree",
            "experience": 6,
            "status": "Approved",
            "processingTime": 13,
            "successRate": 94,
            "profile": {
                "patents": 1,
                "publications": 5,
                "citations": 175,
                "awards": 3
            },
            "timeline": {
                "preparation": 2,
                "submission": 1,
                "uscisReview": 7,
                "rfe": 1,
                "approval": 2
            }
        }
    ]
    
    # Statistics based on similar cases
    stats = {
        "totalSimilarCases": len(similar_cases),
        "averageSuccessRate": 94,
        "averageProcessingTime": 13,
        "commonFactors": [
            "Advanced degree (Master's or PhD)",
            "5+ years of experience",
            "Patents or publications",
            "Evidence of national interest impact"
        ],
        "yourMatchScore": 89,
        "profileStrength": "Strong"
    }
    
    return {
        "similarCases": similar_cases,
        "statistics": stats
    }

# ====== TIMELINE PREDICTOR DATA ======

def get_timeline_prediction_data(user_id: str):
    """Get mock timeline prediction data for Green Card"""
    from datetime import datetime, timedelta
    
    # Current date
    today = datetime.now()
    
    # Define stages with estimated durations - URPE Process until filing
    stages = [
        {
            "id": 1,
            "name": "Complete Documentation Package",
            "duration": 2.5,
            "status": "in_progress",
            "description": "URPE prepares your complete petition package with 15 specialized services (75 days max). Multiple departments work simultaneously: Forms team, Patent specialists, Editorial team, Business analysts, Design/Development team execute services in parallel",
            "startDate": (today - timedelta(days=30)).strftime("%Y-%m-%d"),
            "endDate": (today + timedelta(days=45)).strftime("%Y-%m-%d"),
            "confidence": 100,
            "services": [
                {
                    "id": 1,
                    "category": "Required Forms",
                    "name": "All Required Forms (I-140, I-907, G-1450, DS-260)",
                    "duration": 2,
                    "unit": "days",
                    "status": "completed"
                },
                {
                    "id": 2,
                    "category": "Technical Evidence",
                    "name": "Patent Application Filing (USPTO/SIC)",
                    "duration": 5,
                    "unit": "days",
                    "status": "completed"
                },
                {
                    "id": 3,
                    "category": "Technical Evidence",
                    "name": "Technical Book/Monograph - Writing",
                    "duration": 10,
                    "unit": "days",
                    "status": "completed",
                    "note": "Book drafting phase"
                },
                {
                    "id": 4,
                    "category": "Technical Evidence",
                    "name": "Technical Book/Monograph - Publishing with ISBN",
                    "duration": 5,
                    "unit": "days",
                    "status": "completed",
                    "note": "Publication on Amazon KDP or academic publisher"
                },
                {
                    "id": 5,
                    "category": "Technical Evidence",
                    "name": "Q3/Q4 Academic Articles (3+ papers)",
                    "duration": 60,
                    "unit": "days",
                    "status": "completed",
                    "note": "Indexed in Scopus/Web of Science"
                },
                {
                    "id": 6,
                    "category": "Technical Evidence",
                    "name": "Technical White Paper",
                    "duration": 3,
                    "unit": "days",
                    "status": "completed"
                },
                {
                    "id": 7,
                    "category": "Business Documentation",
                    "name": "National Interest Business Plan",
                    "duration": 5,
                    "unit": "days",
                    "status": "completed"
                },
                {
                    "id": 8,
                    "category": "Business Documentation",
                    "name": "Econometric Study (RIMS II model)",
                    "duration": 5,
                    "unit": "days",
                    "status": "completed"
                },
                {
                    "id": 9,
                    "category": "Business Documentation",
                    "name": "Social/Market Impact Report",
                    "duration": 3,
                    "unit": "days",
                    "status": "completed"
                },
                {
                    "id": 10,
                    "category": "Business Documentation",
                    "name": "Business Case Studies (Harvard style)",
                    "duration": 2,
                    "unit": "days",
                    "status": "completed"
                },
                {
                    "id": 11,
                    "category": "Professional Presence",
                    "name": "Professional Website/Landing Page",
                    "duration": 5,
                    "unit": "days",
                    "status": "completed"
                },
                {
                    "id": 12,
                    "category": "Professional Presence",
                    "name": "Mobile/Web App Development",
                    "duration": 15,
                    "unit": "days",
                    "status": "completed",
                    "note": "Fully functional app showcasing your innovation"
                },
                {
                    "id": 13,
                    "category": "Professional Presence",
                    "name": "Logo Design + Social Media Setup (4 posts)",
                    "duration": 1,
                    "unit": "day",
                    "status": "completed"
                },
                {
                    "id": 14,
                    "category": "Professional Presence",
                    "name": "Press Kit (PDF)",
                    "duration": 1,
                    "unit": "day",
                    "status": "completed"
                },
                {
                    "id": 15,
                    "category": "Letters Package",
                    "name": "Self-Petition + Recommendation + Innovation Letters",
                    "duration": 5,
                    "unit": "days",
                    "status": "completed",
                    "note": "Unlimited recommendation letters drafted by URPE team"
                }
            ]
        },
        {
            "id": 2,
            "name": "Final Review & Filing",
            "duration": 1,
            "durationUnit": "day",
            "status": "pending",
            "description": "URPE team performs final quality review and submits complete I-140 petition package to USCIS",
            "startDate": (today + timedelta(days=45)).strftime("%Y-%m-%d"),
            "endDate": (today + timedelta(days=46)).strftime("%Y-%m-%d"),
            "confidence": 100
        }
    ]
    
    # Factors affecting URPE timeline
    factors = {
        "positive": [
            "Multiple departments work simultaneously on different services",
            "Forms, Patent, Editorial, Business, and Design teams execute in parallel",
            "Expert team with proven track record in EB-2 NIW petitions",
            "Maximum 75 days to filing with optimized workflow"
        ],
        "considerations": [
            "Academic articles (Q3/Q4) may take up to 60 days for publication",
            "Patent filing process requires 5 days for USPTO submission",
            "Book writing and publication combined take 15 days",
            "Client responsiveness affects timeline (prompt document provision)"
        ]
    }
    
    # Overall prediction for Filing (URPE controlled timeline)
    # Total: 2.5 months (Stage1 - 75 days max with parallel execution) + 1 day (Stage2) = ~2.5 months until filing
    prediction = {
        "estimatedTotalMonths": 2.5,
        "estimatedTotalDays": 75,
        "bestCaseMonths": 2,
        "worstCaseMonths": 3,
        "estimatedFilingDate": (today + timedelta(days=46)).strftime("%Y-%m-%d"),
        "confidenceLevel": 95
    }
    
    return {
        "stages": stages,
        "factors": factors,
        "prediction": prediction,
        "generatedAt": today.strftime("%Y-%m-%d")
    }
