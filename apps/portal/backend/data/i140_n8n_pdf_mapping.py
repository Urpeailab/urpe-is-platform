"""\nI-140 N8N PDF Mapping Module\nPorts the JavaScript mapping logic from N8N to Python for precise PDF field mapping.\n"""

import re
from datetime import datetime
from typing import Dict, List, Optional, Any


def format_date(date_string: str) -> str:
    """Format date to MM/DD/YYYY format for USCIS forms."""
    if not date_string:
        return ""
    
    # Already in MM/DD/YYYY format (month 01-12)
    match = re.match(r'^(\d{2})/(\d{2})/(\d{4})$', date_string)
    if match:
        part1, part2, year = int(match.group(1)), int(match.group(2)), match.group(3)
        # If first part > 12, it's DD/MM/YYYY format - swap to MM/DD/YYYY
        if part1 > 12:
            return f"{part2:02d}/{part1:02d}/{year}"
        return date_string
    
    # Try YYYY-MM-DD or ISO format
    try:
        date = datetime.fromisoformat(date_string.replace('Z', '+00:00'))
        return date.strftime('%m/%d/%Y')
    except:
        pass
    
    # Try DD-MM-YYYY
    match = re.match(r'^(\d{2})-(\d{2})-(\d{4})$', date_string)
    if match:
        day, month, year = match.group(1), match.group(2), match.group(3)
        return f"{month}/{day}/{year}"
    
    return date_string


def normalize_value(value: Any) -> str:
    """Normalize value to string and trim."""
    if not value:
        return ""
    return str(value).strip()


def clean_phone_number(phone: str) -> str:
    """Remove non-digit characters from phone number."""
    if not phone:
        return ""
    return re.sub(r'[^\d]', '', phone)


def clean_a_number(a_number: str) -> str:
    """Remove 'A-' prefix from A-Number."""
    if not a_number:
        return ""
    return re.sub(r'^A-?', '', a_number)


def normalize_relationship(relationship: str) -> str:
    """Normalize relationship to standard format."""
    if not relationship:
        return ""
    
    rel = relationship.lower()
    if 'cónyuge' in rel or 'spouse' in rel:
        return "Spouse"
    if 'hijo' in rel or 'child' in rel:
        return "Child"
    return relationship


def normalize_yes_no(value: str) -> str:
    """Normalize yes/no values."""
    if not value:
        return ""
    
    val = str(value).lower()
    if 'sí' in val or 'yes' in val:
        return "Yes"
    if 'no' in val:
        return "No"
    return value


def detect_petition_type(value: str) -> Optional[str]:
    """Detect petition type from value."""
    if not value:
        return None
    
    val = value.lower()
    if "1.h." in val or "niw" in val:
        return "NIW"
    if "1.a." in val or "extraordinary" in val:
        return "EB1A"
    if "1.b." in val or "professor" in val or "researcher" in val:
        return "EB1B"
    if "1.c." in val or "multinational" in val:
        return "EB1C"
    if "1.d." in val or "advanced degree" in val:
        return "EB2"
    if "1.e." in val or "professional" in val:
        return "EB3_Professional"
    if "1.f." in val or "skilled" in val:
        return "EB3_Skilled"
    if "1.g." in val or "other worker" in val:
        return "EB3_Other"
    return None


def detect_petitioner_type(value: str) -> Optional[str]:
    """Detect petitioner type from value."""
    if not value:
        return None
    
    val = value.lower()
    if "1.a." in val or "empleador" in val or "employer" in val:
        return "Employer"
    if "1.b." in val or "auto" in val or "self" in val:
        return "Self"
    if "1.c." in val or "otro" in val or "other" in val:
        return "Other"
    return None


def detect_visa_processing(value: str) -> Optional[str]:
    """Detect visa processing type from value."""
    if not value:
        return None
    
    val = value.lower()
    # Check consular FIRST (1.a) before adjustment (2.a)
    # because consular answers may contain "ee.uu" (e.g. "consulado de EE.UU.")
    if "1.a." in val or "embassy" in val or "consulate" in val or "embajada" in val or "consulado" in val:
        return "ConsularProcessing"
    if "2.a." in val or "adjust" in val or "ajuste" in val:
        return "AdjustmentOfStatus"
    return None


def normalize_state(state: str) -> str:
    """Normalize state name to abbreviation."""
    if not state:
        return ""
    
    state_map = {
        'florida': 'FL', 'california': 'CA', 'new york': 'NY', 'texas': 'TX', 'georgia': 'GA',
        'illinois': 'IL', 'pennsylvania': 'PA', 'ohio': 'OH', 'michigan': 'MI', 'north carolina': 'NC',
        'new jersey': 'NJ', 'virginia': 'VA', 'washington': 'WA', 'massachusetts': 'MA', 'arizona': 'AZ',
        'tennessee': 'TN', 'indiana': 'IN', 'maryland': 'MD', 'missouri': 'MO', 'wisconsin': 'WI',
        'colorado': 'CO', 'minnesota': 'MN', 'south carolina': 'SC', 'alabama': 'AL', 'louisiana': 'LA',
        'kentucky': 'KY', 'oregon': 'OR', 'oklahoma': 'OK', 'connecticut': 'CT', 'utah': 'UT',
        'iowa': 'IA', 'nevada': 'NV', 'arkansas': 'AR', 'mississippi': 'MS', 'kansas': 'KS',
        'new mexico': 'NM', 'nebraska': 'NE', 'west virginia': 'WV', 'idaho': 'ID', 'hawaii': 'HI',
        'new hampshire': 'NH', 'maine': 'ME', 'montana': 'MT', 'rhode island': 'RI', 'delaware': 'DE',
        'south dakota': 'SD', 'north dakota': 'ND', 'alaska': 'AK', 'vermont': 'VT', 'wyoming': 'WY'
    }
    
    lower_state = state.lower().strip()
    
    # Already abbreviated
    if len(lower_state) == 2:
        return lower_state.upper()
    
    # Look for match
    for full_name, abbrev in state_map.items():
        if full_name in lower_state:
            return abbrev
    
    # Return first part before comma
    return state.split(',')[0].strip().upper()


def normalize_country(country: str) -> str:
    """Normalize country name to official format."""
    if not country:
        return ""
    
    country_lower = country.lower().strip()
    
    if 'colombia' in country_lower:
        return "REPUBLIC OF COLOMBIA"
    if 'mexico' in country_lower:
        return "MEXICO"
    if 'argentina' in country_lower:
        return "ARGENTINA"
    if 'venezuela' in country_lower:
        return "VENEZUELA"
    if 'peru' in country_lower:
        return "PERU"
    if 'chile' in country_lower:
        return "CHILE"
    if 'ecuador' in country_lower:
        return "ECUADOR"
    if 'bolivia' in country_lower:
        return "BOLIVIA"
    if 'uruguay' in country_lower:
        return "URUGUAY"
    if 'paraguay' in country_lower:
        return "PARAGUAY"
    
    return country.upper()


def get_field_mapping() -> Dict[str, str]:
    """Return the complete field mapping dictionary."""
    return {
        # === PARTE 1 - PETICIONARIO ===
        "1.a. Apellido (si es individuo)": "form1[0].#subform[0].Pt1Line1a_FamilyName[0]",
        "1.b. Nombre (si es individuo)": "form1[0].#subform[0].Pt1Line1b_GivenName[0]",
        "1.c. Segundo Nombre (si es individuo)": "form1[0].#subform[0].Pt1Line1c_MiddleName[0]",
        "Número de Contacto": "form1[0].#subform[5].Part7_Item5_DayPhone[0]",
        "2. Company or Organization Name": "form1[0].#subform[0].Line2_CompanyName[0]",
        "Line2_CompanyName": "form1[0].#subform[0].Line2_CompanyName[0]",
        "4. IRS Employer Identification Number (EIN)": "form1[0].#subform[0].Pt1Line3_TaxNumber[0]",
        "Pt1Line3_TaxNumber": "form1[0].#subform[0].Pt1Line3_TaxNumber[0]",
        "7. Número de Seguro Social de EE.UU. (si aplica)": "form1[0].#subform[0].Line7_SSN[0]",
        "8. USCIS Online Account Number": "form1[0].#subform[0].#area[1].Pt1Line8_USCISOnlineActNumber[0]",
        "8. USCIS Online Account Number (si aplica)": "form1[0].#subform[0].#area[1].Pt1Line8_USCISOnlineActNumber[0]",
        
        # === PÁGINA 1 - PART 1, SECCIÓN 3: MAILING ADDRESS (PETICIONARIO) ===
        "PETITIONER_MAILING_CARE_OF": "form1[0].#subform[0].Line6a_InCareofName[0]",
        "PETITIONER_MAILING_STREET": "form1[0].#subform[0].Line6b_StreetNumberName[0]",
        "PETITIONER_MAILING_SUITE": "form1[0].#subform[0].Line6c_AptSteFlrNumber[0]",
        "PETITIONER_MAILING_CITY": "form1[0].#subform[0].Line6d_CityOrTown[0]",
        "PETITIONER_MAILING_STATE": "form1[0].#subform[0].Line6e_State[0]",
        "PETITIONER_MAILING_ZIP": "form1[0].#subform[0].Line6f_ZipCode[0]",
        "PETITIONER_MAILING_PROVINCE": "form1[0].#subform[0].Line6h_Province[0]",
        "PETITIONER_MAILING_POSTAL": "form1[0].#subform[0].Line6g_PostalCode[0]",
        "PETITIONER_MAILING_COUNTRY": "form1[0].#subform[0].Line6i_Country[0]",
        "PETITIONER_SUITE_APT": "form1[0].#subform[0].Line6c_Unit[2]",
        "PETITIONER_SUITE_STE": "form1[0].#subform[0].Line6c_Unit[0]",
        "PETITIONER_SUITE_FLR": "form1[0].#subform[0].Line6c_Unit[1]",
        
        # === PÁGINA 2 - PART 3, SECCIÓN 2: MAILING ADDRESS (BENEFICIARIO) ===
        "BENEFICIARY_MAILING_CARE_OF": "form1[0].#subform[1].Line2a_InCareofName[0]",
        "BENEFICIARY_MAILING_STREET": "form1[0].#subform[1].Line2b_StreetNumberName[0]",
        "BENEFICIARY_MAILING_SUITE": "form1[0].#subform[1].Line2c_AptSteFlrNumber[0]",
        "BENEFICIARY_MAILING_CITY": "form1[0].#subform[1].Line2d_CityOrTown[0]",
        "BENEFICIARY_MAILING_STATE": "form1[0].#subform[1].Line2e_State[0]",
        "BENEFICIARY_MAILING_ZIP": "form1[0].#subform[1].Line2f_ZipCode[0]",
        "BENEFICIARY_MAILING_PROVINCE": "form1[0].#subform[1].Line2h_Province[0]",
        "BENEFICIARY_MAILING_POSTAL": "form1[0].#subform[1].Line2g_PostalCode[0]",
        "BENEFICIARY_MAILING_COUNTRY": "form1[0].#subform[1].Line2i_Country[0]",
        "BENEFICIARY_SUITE_APT": "form1[0].#subform[1].Line2c_Unit[2]",
        "BENEFICIARY_SUITE_STE": "form1[0].#subform[1].Line2c_Unit[0]",
        "BENEFICIARY_SUITE_FLR": "form1[0].#subform[1].Line2c_Unit[1]",
        
        # === PÁGINA 2 - PART 4, SECCIÓN 5: MAILING ADDRESS (PETICIONARIO) - ÍTEMS 5.a-5.g ===
        # Nota: Part 4 está en subform[2], sección 5 usa Line3 (no Line2)
        # Line3 fields are for section 5 (Petitioner's US address)
        "PART4_PETITIONER_MAILING_CARE_OF": "form1[0].#subform[2].Line2a_InCareofName[1]",
        "PART4_PETITIONER_MAILING_STREET": "form1[0].#subform[2].Line3d_StreetNumberName[0]",
        "PART4_PETITIONER_MAILING_SUITE": "form1[0].#subform[2].Line3e_AptSteFlrNumber[0]",
        "PART4_PETITIONER_MAILING_CITY": "form1[0].#subform[2].Line3f_CityOrTown[0]",
        "PART4_PETITIONER_MAILING_PROVINCE": "form1[0].#subform[2].Line3h_Province[0]",
        "PART4_PETITIONER_MAILING_POSTAL": "form1[0].#subform[2].Line3g_PostalCode[0]",
        "PART4_PETITIONER_MAILING_COUNTRY": "form1[0].#subform[2].Line3i_Country[0]",
        "PART4_PETITIONER_SUITE_APT": "form1[0].#subform[2].Line3e_Unit[2]",
        "PART4_PETITIONER_SUITE_STE": "form1[0].#subform[2].Line3e_Unit[0]",
        "PART4_PETITIONER_SUITE_FLR": "form1[0].#subform[2].Line3e_Unit[1]",
        
        # Aliases con nombres completos para mapeo directo - Section 5
        "5.a. In Care Of Name (Peticionario)": "form1[0].#subform[2].Line2a_InCareofName[1]",
        "5.b. Street Number and Name (Peticionario)": "form1[0].#subform[2].Line3d_StreetNumberName[0]",
        "5.c. Suite/Apt/Floor Number (Peticionario)": "form1[0].#subform[2].Line3e_AptSteFlrNumber[0]",
        "5.d. City or Town (Peticionario)": "form1[0].#subform[2].Line3f_CityOrTown[0]",
        "5.e. State (Peticionario)": "form1[0].#subform[2].Line3h_Province[0]",
        "5.e. Province (Peticionario)": "form1[0].#subform[2].Line3h_Province[0]",
        "5.f. ZIP Code (Peticionario)": "form1[0].#subform[2].Line3g_PostalCode[0]",
        "5.f. Postal Code (Peticionario)": "form1[0].#subform[2].Line3g_PostalCode[0]",
        "5.g. Country (Peticionario)": "form1[0].#subform[2].Line3i_Country[0]",
        
        # === PART 6: BASIC INFORMATION ABOUT THE PROPOSED EMPLOYMENT ===
        # Page 4 (subform[3])
        "PART6_JOB_TITLE": "form1[0].#subform[3].Line1_JobTitle[0]",
        "PART6_SOC_CODE_1": "form1[0].#subform[3].Line2_SOCCode1[0]",
        "PART6_SOC_CODE_2": "form1[0].#subform[3].Line2_SOCCode2[0]",
        "PART6_JOB_DESCRIPTION": "form1[0].#subform[3].Line3_JobDescription[0]",
        "PART6_FULLTIME_YES": "form1[0].#subform[3].Line4_Yes1[0]",
        "PART6_FULLTIME_NO": "form1[0].#subform[3].Line4_No1[0]",
        "PART6_HOURS_PER_WEEK": "form1[0].#subform[3].Line5_Hours[0]",
        "PART6_PERMANENT_YES": "form1[0].#subform[3].Line6_Yes1[0]",
        "PART6_PERMANENT_NO": "form1[0].#subform[3].Line6_No1[0]",
        "PART6_NEW_POSITION_YES": "form1[0].#subform[3].Line7_Yes1[0]",
        "PART6_NEW_POSITION_NO": "form1[0].#subform[3].Line7_No1[0]",
        "PART6_WAGES": "form1[0].#subform[3].Line8_Wages[0]",
        "PART6_WAGES_PER": "form1[0].#subform[3].Line8_Per[0]",
        
        # Part 6 Aliases for questionnaire
        "Part 6 - 1. Job Title": "form1[0].#subform[3].Line1_JobTitle[0]",
        "Part 6 - 2. SOC Code": "SPLIT_SOC_CODE",  # Special handling for XX-XXXX format
        "Part 6 - 3. Nontechnical Job Description": "form1[0].#subform[3].Line3_JobDescription[0]",
        "Part 6 - 4. Is this a full-time position?": "PART6_FULLTIME",  # Special handling Yes/No
        "Part 6 - 5. Hours per week": "form1[0].#subform[3].Line5_Hours[0]",
        "Part 6 - 6. Is this a permanent position?": "PART6_PERMANENT",  # Special handling Yes/No
        "Part 6 - 7. Is this a new position?": "PART6_NEW_POSITION",  # Special handling Yes/No
        "Part 6 - 8. Wages": "form1[0].#subform[3].Line8_Wages[0]",
        "Part 6 - 8. Wages Per": "form1[0].#subform[3].Line8_Per[0]",
        
        # === PART 7: COMPLETE ONLY IF DIRECT RELATIVES LIVE WITH THE BENEFICIARY ===
        # Person 1 (Page 4 - subform[3])
        "PERSON1_ADJUSTMENT_YES": "form1[0].#subform[3].Pt7ItemNumber5_CheckboxYes[0]",
        "PERSON1_ADJUSTMENT_NO": "form1[0].#subform[3].Pt7ItemNumber5_CheckboxNo[0]",
        "PERSON1_VISA_ABROAD_YES": "form1[0].#subform[3].Pt7ItemNumber6_CheckboxYes[0]",
        "PERSON1_VISA_ABROAD_NO": "form1[0].#subform[3].Pt7ItemNumber6_CheckboxNo[0]",
        
        # Person 2 (Page 4 - subform[3])
        "PERSON2_ADJUSTMENT_YES": "form1[0].#subform[3].Pt7ItemNumber11_CheckboxYes[0]",
        "PERSON2_ADJUSTMENT_NO": "form1[0].#subform[3].Pt7ItemNumber11_CheckboxNo[0]",
        "PERSON2_VISA_ABROAD_YES": "form1[0].#subform[3].Pt7ItemNumber12_CheckboxYes[0]",
        "PERSON2_VISA_ABROAD_NO": "form1[0].#subform[3].Pt7ItemNumber12_CheckboxNo[0]",
        
        # Person 3 (Page 5 - subform[4])
        "PERSON3_ADJUSTMENT_YES": "form1[0].#subform[4].Pt7ItemNumber17_CheckboxYes[0]",
        "PERSON3_ADJUSTMENT_NO": "form1[0].#subform[4].Pt7ItemNumber17_CheckboxNo[0]",
        "PERSON3_VISA_ABROAD_YES": "form1[0].#subform[4].Pt7ItemNumber18_CheckboxYes[0]",
        "PERSON3_VISA_ABROAD_NO": "form1[0].#subform[4].Pt7ItemNumber18_CheckboxNo[0]",
        
        # Person 4 (Page 5 - subform[4])
        "PERSON4_ADJUSTMENT_YES": "form1[0].#subform[4].Pt7ItemNumber23_CheckboxYes[0]",
        "PERSON4_ADJUSTMENT_NO": "form1[0].#subform[4].Pt7ItemNumber23_CheckboxNo[0]",
        "PERSON4_VISA_ABROAD_YES": "form1[0].#subform[4].Pt7ItemNumber24_CheckboxYes[0]",
        "PERSON4_VISA_ABROAD_NO": "form1[0].#subform[4].Pt7ItemNumber24_CheckboxNo[0]",
        
        # Person 5 (Page 5 - subform[4])
        "PERSON5_ADJUSTMENT_YES": "form1[0].#subform[4].Pt7ItemNumber29_CheckboxYes[0]",
        "PERSON5_ADJUSTMENT_NO": "form1[0].#subform[4].Pt7ItemNumber29_CheckboxNo[0]",
        "PERSON5_VISA_ABROAD_YES": "form1[0].#subform[4].Pt7ItemNumber30_CheckboxYes[0]",
        "PERSON5_VISA_ABROAD_NO": "form1[0].#subform[4].Pt7ItemNumber30_CheckboxNo[0]",
        
        # Person 6 (Page 5 - subform[4])
        "PERSON6_ADJUSTMENT_YES": "form1[0].#subform[4].Pt7ItemNumber35_CheckboxYes[0]",
        "PERSON6_ADJUSTMENT_NO": "form1[0].#subform[4].Pt7ItemNumber35_CheckboxNo[0]",
        "PERSON6_VISA_ABROAD_YES": "form1[0].#subform[4].Pt7ItemNumber36_CheckboxYes[0]",
        "PERSON6_VISA_ABROAD_NO": "form1[0].#subform[4].Pt7ItemNumber36_CheckboxNo[0]",
        
        # Questionnaire aliases for Person 1-6
        "Persona 1 - Adjustment of Status": "PERSON1_ADJUSTMENT",
        "Persona 1 - Visa Abroad": "PERSON1_VISA_ABROAD",
        "Persona 2 - Adjustment of Status": "PERSON2_ADJUSTMENT",
        "Persona 2 - Visa Abroad": "PERSON2_VISA_ABROAD",
        "Persona 3 - Adjustment of Status": "PERSON3_ADJUSTMENT",
        "Persona 3 - Visa Abroad": "PERSON3_VISA_ABROAD",
        "Persona 4 - Adjustment of Status": "PERSON4_ADJUSTMENT",
        "Persona 4 - Visa Abroad": "PERSON4_VISA_ABROAD",
        "Persona 5 - Adjustment of Status": "PERSON5_ADJUSTMENT",
        "Persona 5 - Visa Abroad": "PERSON5_VISA_ABROAD",
        "Persona 6 - Adjustment of Status": "PERSON6_ADJUSTMENT",
        "Persona 6 - Visa Abroad": "PERSON6_VISA_ABROAD",
        
        # Aliases para beneficiario
        "2.a. In Care Of Name (Beneficiario)": "form1[0].#subform[1].Line2a_InCareofName[0]",
        
        # Aliases para facilitar el mapeo desde el frontend
        "2.b. Street Number and Name (Beneficiario)": "form1[0].#subform[1].Line2b_StreetNumberName[0]",
        "2.c. Suite/Apt/Floor Number (Beneficiario)": "form1[0].#subform[1].Line2c_AptSteFlrNumber[0]",
        "2.d. City or Town (Beneficiario)": "form1[0].#subform[1].Line2d_CityOrTown[0]",
        "2.e. State (Beneficiario)": "form1[0].#subform[1].Line2e_State[0]",
        "2.f. ZIP Code (Beneficiario)": "form1[0].#subform[1].Line2f_ZipCode[0]",
        "2.h. Province (Beneficiario)": "form1[0].#subform[1].Line2h_Province[0]",
        "2.g. Postal Code (Beneficiario)": "form1[0].#subform[1].Line2g_PostalCode[0]",
        "2.i. Country (Beneficiario)": "form1[0].#subform[1].Line2i_Country[0]",
        
        # Información adicional del beneficiario
        "A-Number del Beneficiario": "form1[0].#subform[1].Line5_AlienNumber[0]",
        "Email del Beneficiario": "form1[0].#subform[5].Line8_Email[0]",
        
        # === PROCESSING INFORMATION ===
        "1.a. Ciudad o Pueblo": "form1[0].#subform[1].Line1a_CityorTown[0]",
        "1.b. City or Town": "form1[0].#subform[1].Line1a_CityorTown[0]",
        "1.c. País": "form1[0].#subform[1].Line1a_Country[0]",
        "1.c. Country": "form1[0].#subform[1].Line1a_Country[0]",
        
        # === PROCESSING INFORMATION CONTINUED (Página 3) ===
        "3.a. Street Number and Name": "form1[0].#subform[2].Line2a_StreetNumberName[0]",
        "3.a. Número y Nombre de la Calle": "form1[0].#subform[2].Line2a_StreetNumberName[0]",
        "3.b. Apartamento": "form1[0].#subform[2].Line2b_AptSteFlrNumber[0]",
        "3.b. Apt": "form1[0].#subform[2].Line2b_AptSteFlrNumber[0]",
        "3.c. Ciudad": "form1[0].#subform[2].Line2c_CityOrTown[0]",
        "3.c. City or Town": "form1[0].#subform[2].Line2c_CityOrTown[0]",
        "3.d. Provincia": "form1[0].#subform[2].Line2e_Province[0]",
        "3.d. Province": "form1[0].#subform[2].Line2e_Province[0]",
        "3.e. Código Postal": "form1[0].#subform[2].Line2d_PostalCode[0]",
        "3.e. Postal Code": "form1[0].#subform[2].Line2d_PostalCode[0]",
        "3.f. País": "form1[0].#subform[2].Line2f_Country[0]",
        "3.f. Country": "form1[0].#subform[2].Line2f_Country[0]",
        "FOREIGN_ADDRESS_APT": "form1[0].#subform[2].Line2b_Unit[2]",
        "FOREIGN_ADDRESS_STE": "form1[0].#subform[2].Line2b_Unit[0]",
        "FOREIGN_ADDRESS_FLR": "form1[0].#subform[2].Line2b_Unit[1]",
        
        # === PARTE 5 - ADDITIONAL INFORMATION ABOUT PETITIONER ===
        "2. Type of Business": "form1[0].#subform[2].Line2a_TypeofBusiness[0]",
        "3. Date Established": "form1[0].#subform[2].Line2b_DateEstablished[0]",
        "4. Current Number of U.S. Employees": "form1[0].#subform[2].Line2c_NumberofEmployees[0]",
        "5. Gross Annual Income": "form1[0].#subform[2].Line2d_GrossAnnualIncome[0]",
        "6. Net Annual Income": "form1[0].#subform[2].Line2e_NetAnnualIncome[0]",
        "7. NAICS Code": "form1[0].#subform[2].Line2f[0].Line2f_NAICSCode[0]",
        "8. Labor Certification DOL Case Number": "form1[0].#subform[2].Line2g_LaborCertification[0]",
        
        # === PARTE 6 - BASIC INFORMATION ABOUT PROPOSED EMPLOYMENT ===
        "1. Job Title": "form1[0].#subform[3].Line1_JobTitle[0]",
        "2. SOC Code Part 1": "form1[0].#subform[3].Line2_SOCCode1[0]",
        "2. SOC Code Part 2": "form1[0].#subform[3].Line2_SOCCode2[0]",
        "3. Nontechnical Job Description": "form1[0].#subform[3].Line3_JobDescription[0]",
        "4. Is this a full-time position?_Yes": "form1[0].#subform[3].Line4_Yes1[0]",
        "4. Is this a full-time position?_No": "form1[0].#subform[3].Line4_No1[0]",
        "5. Hours per week": "form1[0].#subform[3].Line5_Hours[0]",
        "6. Is this a permanent position?_Yes": "form1[0].#subform[3].Line6_Yes1[0]",
        "6. Is this a permanent position?_No": "form1[0].#subform[3].Line6_No1[0]",
        "7. Is this a new position?_Yes": "form1[0].#subform[3].Line7_Yes1[0]",
        "7. Is this a new position?_No": "form1[0].#subform[3].Line7_No1[0]",
        "8. Wages Amount": "form1[0].#subform[3].Line8_Wages[0]",
        "8. Wages Per": "form1[0].#subform[3].Line8_Per[0]",
        
        # === LABOR CERTIFICATION DATES ===
        "9. Labor Certification DOL Filing Date": "form1[0].#subform[3].Line2h_LaborCertification[0]",
        "10. Labor Certification Expiration Date": "form1[0].#subform[3].Line2i_LaborCertificationDate[0]",
        
        # === FORMULARIOS ADICIONALES ===
        "Form I-485": "form1[0].#subform[2].Line4_Form485[0]",
        "Form I-131": "form1[0].#subform[2].Line4_Form131[0]",
        "Form I-765": "form1[0].#subform[2].Line4_Form765[0]",
        "Other Form": "form1[0].#subform[2].Line4_OtherAttach[0]",
        
        # === PETICIÓN PREVIA ===
        "Previous Petition Receipt Number": "form1[0].#subform[1].Line2aReceipt[0].Line2a_ReceiptNumber[0]",
        
        # === PREGUNTAS PARTE 1 ===
        "5. ¿Es una organización sin fines de lucro exenta de impuestos o una organización gubernamental de investigación?_No": "form1[0].#subform[0].P1_Line5_Checkbox[0]",
        "5. ¿Es una organización sin fines de lucro exenta de impuestos o una organización gubernamental de investigación?_Yes": "form1[0].#subform[0].P1_Line5_Checkbox[1]",
        "6. ¿Emplea actualmente un total de 25 o menos empleados equivalentes a tiempo completo?_No": "form1[0].#subform[0].P1_Line6_Checkbox[0]",
        "6. ¿Emplea actualmente un total de 25 o menos empleados equivalentes a tiempo completo?_Yes": "form1[0].#subform[0].P1_Line6_Checkbox[1]",
        
        # === TIPOS DE PETICIÓN ===
        "PetitionType_EB3_Professional": "form1[0].#subform[0].prt2PetitionType[0]",
        "PetitionType_EB1A": "form1[0].#subform[0].prt2PetitionType[1]",
        "PetitionType_EB1B": "form1[0].#subform[0].prt2PetitionType[2]",
        "PetitionType_EB1C": "form1[0].#subform[0].prt2PetitionType[3]",
        "PetitionType_EB2": "form1[0].#subform[0].prt2PetitionType[4]",
        "PetitionType_EB3_Other": "form1[0].#subform[1].prt2PetitionType[5]",
        "PetitionType_NIW": "form1[0].#subform[1].prt2PetitionType[6]",
        "PetitionType_EB3_Skilled": "form1[0].#subform[1].prt2PetitionType[7]",
        
        # === PARTE 3 - BENEFICIARIO ===
        "1.a. Apellido del Beneficiario": "form1[0].#subform[1].Pt3Line1a_FamilyName[0]",
        "1.b. Nombre del Beneficiario": "form1[0].#subform[1].Pt3Line1b_GivenName[0]",
        "1.c. Segundo Nombre del Beneficiario": "form1[0].#subform[1].Pt3Line1c_MiddleName[0]",
        "3. Fecha de Nacimiento": "form1[0].#subform[1].Line5_DateOfBirth[0]",
        "4. Ciudad/Pueblo de Nacimiento": "form1[0].#subform[1].Line6_CityTownOfBirth[0]",
        "5. Estado o Provincia de Nacimiento": "form1[0].#subform[1].Line7_StateProvinceOfBirth[0]",
        "6. País de Nacimiento": "form1[0].#subform[1].Line8_Country[0]",
        "7. País de Ciudadanía o Nacionalidad": "form1[0].#subform[1].Line9_Country[0]",
        "8. Número de Registro de Extranjero (A-Number)": "form1[0].#subform[1].Line11_Alien[0].Pt3Line8_AlienNumber[0]",
        "9. Número de Seguro Social de EE.UU. (si aplica)": "form1[0].#subform[1].Line12_SSN[0]",
        
        # === INFORMACIÓN DE LLEGADA ===
        "10. Fecha de Última Llegada": "form1[0].#subform[1].Line13_DateOArrival[0]",
        "11.a. Número de Registro I-94": "form1[0].#subform[1].Line14_I94Number[0].Line14a_ArrivalDeparture[0]",
        "11.b. Fecha de Vencimiento de Estadía Autorizada en I-94": "form1[0].#subform[1].Line14e_ExpDate[1]",
        "11.c. Estatus en Formulario I-94": "form1[0].#subform[1].Line15_CurrentNon[0]",
        "12. Número de Pasaporte": "form1[0].#subform[1].Line14b_Passport[0]",
        "13. Número de Documento de Viaje": "form1[0].#subform[1].Line14c_TravelDoc[0]",
        "14. País de Expedición del Pasaporte o Documento de Viaje": "form1[0].#subform[1].Line14d_CountryOfIssuance[0]",
        "15. Fecha de Vencimiento del Pasaporte o Documento de Viaje": "form1[0].#subform[1].Line14e_ExpDate[0]",
        
        # === PROCESAMIENTO DE VISA ===
        "ProcessingType_AdjustmentOfStatus": "form1[0].#subform[1].Line1b_Status[0]",
        "ProcessingType_ConsularProcessing": "form1[0].#subform[1].Line1a_Visa[0]",
        "2.b. País de residencia actual del beneficiario": "form1[0].#subform[2].Line1b_Country[0]",
        
        # === PREGUNTAS PARTE 4 ===
        "Parte 4, Ítem 6.a: ¿Está presentando otras solicitudes con este I-140?_Yes": "form1[0].#subform[2].Line4_Yes[0]",
        "Parte 4, Ítem 6.a: ¿Está presentando otras solicitudes con este I-140?_No": "form1[0].#subform[2].Line4_No[0]",
        "Parte 4, Ítem 7: ¿Está el beneficiario en proceso de deportación?_Yes": "form1[0].#subform[2].Line5_Yes[0]",
        "Parte 4, Ítem 7: ¿Está el beneficiario en proceso de deportación?_No": "form1[0].#subform[2].Line5_No[0]",
        "Parte 4, Ítem 8: ¿Se ha presentado antes una petición de visa de inmigrante para esta persona?_Yes": "form1[0].#subform[2].Line6_Yes[0]",
        "Parte 4, Ítem 8: ¿Se ha presentado antes una petición de visa de inmigrante para esta persona?_No": "form1[0].#subform[2].Line6_No[0]",
        "Parte 4, Ítem 9: ¿Presenta sin cert. laboral original por haberla enviado con otro I-140?_Yes": "form1[0].#subform[2].Line7_Yes[0]",
        "Parte 4, Ítem 9: ¿Presenta sin cert. laboral original por haberla enviado con otro I-140?_No": "form1[0].#subform[2].Line7_No[0]",
        "Parte 4, Ítem 10: ¿Solicita que USCIS pida un duplicado de la cert. laboral al DOL?_Yes": "form1[0].#subform[2].Line8_Yes[0]",
        "Parte 4, Ítem 10: ¿Solicita que USCIS pida un duplicado de la cert. laboral al DOL?_No": "form1[0].#subform[2].Line8_No[0]",
        
        # === TIPO DE PETICIONARIO ===
        "PetitionerType_Employer": "form1[0].#subform[2].Line1a_Employer[0]",
        "PetitionerType_Self": "form1[0].#subform[2].Line1b_Self[0]",
        "PetitionerType_Other": "form1[0].#subform[2].Line1c_Other[0]",
        
        # === INFORMACIÓN DEL TRABAJO ===
        "11. Ocupación del Peticionario Individual": "form1[0].#subform[3].Line3a_Occupation[0]",
        "12. Ingreso Anual del Peticionario Individual": "form1[0].#subform[3].Line3b_AnnualIncome[0]",
        
        # === DIRECCIÓN DE TRABAJO ===
        "9.a. Dirección donde trabajará - Número y Nombre de la Calle": "form1[0].#subform[3].Line9a_StreetNumberName[0]",
        "9.b. Apartamento, Suite, Piso": "form1[0].#subform[3].Line9b_AptSteFlrNumber[0]",
        "9.c. Ciudad o Pueblo": "form1[0].#subform[3].Line9c_CityOrTown[0]",
        "9.d. Estado": "form1[0].#subform[3].Line9d_State[0]",
        "9.e. Código ZIP": "form1[0].#subform[3].Line9e_ZipCode[0]",
        "WORK_SUITE_APT": "form1[0].#subform[3].Line9b_Unit[2]",
        "WORK_SUITE_STE": "form1[0].#subform[3].Line9b_Unit[0]",
        "WORK_SUITE_FLR": "form1[0].#subform[3].Line9b_Unit[1]",
        
        # === FAMILIA - PERSONA 1 ===
        # Legacy names (backward compatibility)
        "1.a. Apellido (Persona 1)": "form1[0].#subform[3].Line1a_Person1FamilyName[0]",
        "1.b. Nombre (Persona 1)": "form1[0].#subform[3].Line1b_Person1GivenName[0]",
        "1.c. Segundo Nombre (Persona 1)": "form1[0].#subform[3].Line1c_Person1MiddleName[0]",
        "2. Fecha de Nacimiento (Persona 1)": "form1[0].#subform[3].Line1d_Person1DateOfBirth[0]",
        "3. País de Nacimiento (Persona 1)": "form1[0].#subform[3].Line1e_CountryOfBirth[0]",
        "4. Relación (Persona 1)": "form1[0].#subform[3].Line1f_Relationship[0]",
        "5. ¿Solicitará ajuste de estatus? (Persona 1)_Yes": "form1[0].#subform[3].Pt7ItemNumber5_CheckboxYes[0]",
        "5. ¿Solicitará ajuste de estatus? (Persona 1)_No": "form1[0].#subform[3].Pt7ItemNumber5_CheckboxNo[0]",
        "6. ¿Solicitará visa en el extranjero? (Persona 1)_Yes": "form1[0].#subform[3].Pt7ItemNumber6_CheckboxYes[0]",
        "6. ¿Solicitará visa en el extranjero? (Persona 1)_No": "form1[0].#subform[3].Pt7ItemNumber6_CheckboxNo[0]",
        # New question text names (from database template)
        "Persona 1 - Apellido": "form1[0].#subform[3].Line1a_Person1FamilyName[0]",
        "Persona 1 - Nombre": "form1[0].#subform[3].Line1b_Person1GivenName[0]",
        "Persona 1 - Segundo Nombre": "form1[0].#subform[3].Line1c_Person1MiddleName[0]",
        "Persona 1 - Fecha de Nacimiento": "form1[0].#subform[3].Line1d_Person1DateOfBirth[0]",
        "Persona 1 - País de Nacimiento": "form1[0].#subform[3].Line1e_CountryOfBirth[0]",
        "Persona 1 - Relación con el Beneficiario": "form1[0].#subform[3].Line1f_Relationship[0]",
        "Persona 1 - Adjustment of Status": "PERSON1_ADJUSTMENT",  # Special handling
        "Persona 1 - Visa Abroad": "PERSON1_VISA_ABROAD",  # Special handling
        
        # === FAMILIA - PERSONA 2 ===
        # Legacy names
        "7.a. Apellido (Persona 2)": "form1[0].#subform[3].Line2a_Person2FamilyName[0]",
        "7.b. Nombre (Persona 2)": "form1[0].#subform[3].Line2b_Person2GivenName[0]",
        "7.c. Segundo Nombre (Persona 2)": "form1[0].#subform[3].Line2c_Person2MiddleName[0]",
        "8. Fecha de Nacimiento (Persona 2)": "form1[0].#subform[3].Line2d_DateOfBirth[0]",
        "9. País de Nacimiento (Persona 2)": "form1[0].#subform[3].Line2e_CountryOfBirth[0]",
        "10. Relación (Persona 2)": "form1[0].#subform[3].Line2f_Relationship[0]",
        "11. ¿Solicitará ajuste de estatus? (Persona 2)_Yes": "form1[0].#subform[3].Pt7ItemNumber11_CheckboxYes[0]",
        "11. ¿Solicitará ajuste de estatus? (Persona 2)_No": "form1[0].#subform[3].Pt7ItemNumber11_CheckboxNo[0]",
        "12. ¿Solicitará visa en el extranjero? (Persona 2)_Yes": "form1[0].#subform[3].Pt7ItemNumber12_CheckboxYes[0]",
        "12. ¿Solicitará visa en el extranjero? (Persona 2)_No": "form1[0].#subform[3].Pt7ItemNumber12_CheckboxNo[0]",
        # New question text names
        "Persona 2 - Apellido": "form1[0].#subform[3].Line2a_Person2FamilyName[0]",
        "Persona 2 - Nombre": "form1[0].#subform[3].Line2b_Person2GivenName[0]",
        "Persona 2 - Segundo Nombre": "form1[0].#subform[3].Line2c_Person2MiddleName[0]",
        "Persona 2 - Fecha de Nacimiento": "form1[0].#subform[3].Line2d_DateOfBirth[0]",
        "Persona 2 - País de Nacimiento": "form1[0].#subform[3].Line2e_CountryOfBirth[0]",
        "Persona 2 - Relación con el Beneficiario": "form1[0].#subform[3].Line2f_Relationship[0]",
        "Persona 2 - Adjustment of Status": "PERSON2_ADJUSTMENT",
        "Persona 2 - Visa Abroad": "PERSON2_VISA_ABROAD",
        
        # === PERSONAS 3-6 ===
        # Persona 3 - Legacy
        "13.a. Apellido (Persona 3)": "form1[0].#subform[4].Line2a_Person2FamilyName[1]",
        "13.b. Nombre (Persona 3)": "form1[0].#subform[4].Line2b_Person2GivenName[1]",
        "13.c. Segundo Nombre (Persona 3)": "form1[0].#subform[4].Line2c_Person2MiddleName[1]",
        "14. Fecha de Nacimiento (Persona 3)": "form1[0].#subform[4].Line2d_DateOfBirth[1]",
        "15. País de Nacimiento (Persona 3)": "form1[0].#subform[4].Line2e_CountryOfBirth[1]",
        "16. Relación (Persona 3)": "form1[0].#subform[4].Line2f_Relationship[1]",
        "17. ¿Solicitará ajuste de estatus? (Persona 3)_Yes": "form1[0].#subform[4].Pt7ItemNumber17_CheckboxYes[0]",
        "17. ¿Solicitará ajuste de estatus? (Persona 3)_No": "form1[0].#subform[4].Pt7ItemNumber17_CheckboxNo[0]",
        "18. ¿Solicitará visa en el extranjero? (Persona 3)_Yes": "form1[0].#subform[4].Pt7ItemNumber18_CheckboxYes[0]",
        "18. ¿Solicitará visa en el extranjero? (Persona 3)_No": "form1[0].#subform[4].Pt7ItemNumber18_CheckboxNo[0]",
        # Persona 3 - New
        "Persona 3 - Apellido": "form1[0].#subform[4].Line2a_Person2FamilyName[1]",
        "Persona 3 - Nombre": "form1[0].#subform[4].Line2b_Person2GivenName[1]",
        "Persona 3 - Segundo Nombre": "form1[0].#subform[4].Line2c_Person2MiddleName[1]",
        "Persona 3 - Fecha de Nacimiento": "form1[0].#subform[4].Line2d_DateOfBirth[1]",
        "Persona 3 - País de Nacimiento": "form1[0].#subform[4].Line2e_CountryOfBirth[1]",
        "Persona 3 - Relación con el Beneficiario": "form1[0].#subform[4].Line2f_Relationship[1]",
        "Persona 3 - Adjustment of Status": "PERSON3_ADJUSTMENT",
        "Persona 3 - Visa Abroad": "PERSON3_VISA_ABROAD",
        
        # Persona 4 - Legacy
        "19.a. Apellido (Persona 4)": "form1[0].#subform[4].Line2a_Person2FamilyName[2]",
        "19.b. Nombre (Persona 4)": "form1[0].#subform[4].Line2b_Person2GivenName[2]",
        "19.c. Segundo Nombre (Persona 4)": "form1[0].#subform[4].Line2c_Person2MiddleName[2]",
        "20. Fecha de Nacimiento (Persona 4)": "form1[0].#subform[4].Line2d_DateOfBirth[2]",
        "21. País de Nacimiento (Persona 4)": "form1[0].#subform[4].Line2e_CountryOfBirth[2]",
        "22. Relación (Persona 4)": "form1[0].#subform[4].Line2f_Relationship[2]",
        "23. ¿Solicitará ajuste de estatus? (Persona 4)_Yes": "form1[0].#subform[4].Pt7ItemNumber23_CheckboxYes[0]",
        "23. ¿Solicitará ajuste de estatus? (Persona 4)_No": "form1[0].#subform[4].Pt7ItemNumber23_CheckboxNo[0]",
        "24. ¿Solicitará visa en el extranjero? (Persona 4)_Yes": "form1[0].#subform[4].Pt7ItemNumber24_CheckboxYes[0]",
        "24. ¿Solicitará visa en el extranjero? (Persona 4)_No": "form1[0].#subform[4].Pt7ItemNumber24_CheckboxNo[0]",
        # Persona 4 - New
        "Persona 4 - Apellido": "form1[0].#subform[4].Line2a_Person2FamilyName[2]",
        "Persona 4 - Nombre": "form1[0].#subform[4].Line2b_Person2GivenName[2]",
        "Persona 4 - Segundo Nombre": "form1[0].#subform[4].Line2c_Person2MiddleName[2]",
        "Persona 4 - Fecha de Nacimiento": "form1[0].#subform[4].Line2d_DateOfBirth[2]",
        "Persona 4 - País de Nacimiento": "form1[0].#subform[4].Line2e_CountryOfBirth[2]",
        "Persona 4 - Relación con el Beneficiario": "form1[0].#subform[4].Line2f_Relationship[2]",
        "Persona 4 - Adjustment of Status": "PERSON4_ADJUSTMENT",
        "Persona 4 - Visa Abroad": "PERSON4_VISA_ABROAD",
        
        # Persona 5 - Legacy
        "25.a. Apellido (Persona 5)": "form1[0].#subform[4].Line2a_Person2FamilyName[3]",
        "25.b. Nombre (Persona 5)": "form1[0].#subform[4].Line2b_Person2GivenName[3]",
        "25.c. Segundo Nombre (Persona 5)": "form1[0].#subform[4].Line2c_Person2MiddleName[3]",
        "26. Fecha de Nacimiento (Persona 5)": "form1[0].#subform[4].Line2d_DateOfBirth[3]",
        "27. País de Nacimiento (Persona 5)": "form1[0].#subform[4].Line2e_CountryOfBirth[4]",
        "28. Relación (Persona 5)": "form1[0].#subform[4].Line2f_Relationship[3]",
        "29. ¿Solicitará ajuste de estatus? (Persona 5)_Yes": "form1[0].#subform[4].Pt7ItemNumber29_CheckboxYes[0]",
        "29. ¿Solicitará ajuste de estatus? (Persona 5)_No": "form1[0].#subform[4].Pt7ItemNumber29_CheckboxNo[0]",
        "30. ¿Solicitará visa en el extranjero? (Persona 5)_Yes": "form1[0].#subform[4].Pt7ItemNumber30_CheckboxYes[0]",
        "30. ¿Solicitará visa en el extranjero? (Persona 5)_No": "form1[0].#subform[4].Pt7ItemNumber30_CheckboxNo[0]",
        # Persona 5 - New
        "Persona 5 - Apellido": "form1[0].#subform[4].Line2a_Person2FamilyName[3]",
        "Persona 5 - Nombre": "form1[0].#subform[4].Line2b_Person2GivenName[3]",
        "Persona 5 - Segundo Nombre": "form1[0].#subform[4].Line2c_Person2MiddleName[3]",
        "Persona 5 - Fecha de Nacimiento": "form1[0].#subform[4].Line2d_DateOfBirth[3]",
        "Persona 5 - País de Nacimiento": "form1[0].#subform[4].Line2e_CountryOfBirth[4]",
        "Persona 5 - Relación con el Beneficiario": "form1[0].#subform[4].Line2f_Relationship[3]",
        "Persona 5 - Adjustment of Status": "PERSON5_ADJUSTMENT",
        "Persona 5 - Visa Abroad": "PERSON5_VISA_ABROAD",
        
        # Persona 6 - Legacy
        "31.a. Apellido (Persona 6)": "form1[0].#subform[4].Line2a_Person2FamilyName[4]",
        "31.b. Nombre (Persona 6)": "form1[0].#subform[4].Line2b_Person2GivenName[4]",
        "31.c. Segundo Nombre (Persona 6)": "form1[0].#subform[4].Line2c_Person2MiddleName[4]",
        "32. Fecha de Nacimiento (Persona 6)": "form1[0].#subform[4].Line2d_DateOfBirth[4]",
        "33. País de Nacimiento (Persona 6)": "form1[0].#subform[4].Line2e_CountryOfBirth[3]",
        "34. Relación (Persona 6)": "form1[0].#subform[4].Line2f_Relationship[4]",
        "35. ¿Solicitará ajuste de estatus? (Persona 6)_Yes": "form1[0].#subform[4].Pt7ItemNumber35_CheckboxYes[0]",
        "35. ¿Solicitará ajuste de estatus? (Persona 6)_No": "form1[0].#subform[4].Pt7ItemNumber35_CheckboxNo[0]",
        "36. ¿Solicitará visa en el extranjero? (Persona 6)_Yes": "form1[0].#subform[4].Pt7ItemNumber36_CheckboxYes[0]",
        "36. ¿Solicitará visa en el extranjero? (Persona 6)_No": "form1[0].#subform[4].Pt7ItemNumber36_CheckboxNo[0]",
        # Persona 6 - New
        "Persona 6 - Apellido": "form1[0].#subform[4].Line2a_Person2FamilyName[4]",
        "Persona 6 - Nombre": "form1[0].#subform[4].Line2b_Person2GivenName[4]",
        "Persona 6 - Segundo Nombre": "form1[0].#subform[4].Line2c_Person2MiddleName[4]",
        "Persona 6 - Fecha de Nacimiento": "form1[0].#subform[4].Line2d_DateOfBirth[4]",
        "Persona 6 - País de Nacimiento": "form1[0].#subform[4].Line2e_CountryOfBirth[3]",
        "Persona 6 - Relación con el Beneficiario": "form1[0].#subform[4].Line2f_Relationship[4]",
        "Persona 6 - Adjustment of Status": "PERSON6_ADJUSTMENT",
        "Persona 6 - Visa Abroad": "PERSON6_VISA_ABROAD",
        
        # === CERTIFICACIÓN Y FIRMA ===
        "1.a. Apellido del Signatario": "form1[0].#subform[5].Part7_Item3a_FamilyName[0]",
        "1.b. Nombre del Signatario": "form1[0].#subform[5].Part7_Item3b_GivenName[0]",
        "2. Título del Signatario": "form1[0].#subform[5].Part7_Item4_Title[0]",
        "3. Teléfono de Día": "form1[0].#subform[5].Part7_Item5_DayPhone[0]",
        "4. Teléfono Móvil": "form1[0].#subform[5].Part7_Item6_MobilePhone[0]",
        "5. Dirección de Email": "form1[0].#subform[5].Part7_Item7_Email[0]",
        "6.b. Fecha de Firma": "form1[0].#subform[5].Part7_Item8b_Date[0]"
    }


def fill_i140_form_n8n(filled_form: Dict[str, Any]) -> Dict[str, Any]:
    """
    Main function to process I-140 form data and generate PDF field mappings.
    Ports the complete JavaScript logic from N8N.
    """
    field_mapping = get_field_mapping()
    formatted_fields = []
    
    # Helper function to get value from filled_form with fallback
    def get_form_value(key: str, default: str = "") -> str:
        value = filled_form.get(key)
        if value and str(value).strip():
            return str(value).strip()
        return default
    
    # Default company address values (fallback if not provided in form)
    DEFAULT_COMPANY = {
        "street": "3235 NORTH POINT PKWY",
        "suite": "101",
        "city": "ALPHARETTA",
        "state": "GA",
        "zip": "30005",
        "country": "THE UNITED STATES OF AMERICA"
    }
    
    # Get Part 4 address values from form or use defaults
    part4_care_of = get_form_value("5.a. In Care Of Name (Peticionario)", "")
    part4_street = get_form_value("5.b. Street Number and Name (Peticionario)", DEFAULT_COMPANY["street"])
    part4_suite = get_form_value("5.c. Suite/Apt/Floor Number (Peticionario)", DEFAULT_COMPANY["suite"])
    part4_city = get_form_value("5.d. City or Town (Peticionario)", DEFAULT_COMPANY["city"])
    part4_state = get_form_value("5.e. State (Peticionario)", DEFAULT_COMPANY["state"])
    part4_zip = get_form_value("5.f. ZIP Code (Peticionario)", DEFAULT_COMPANY["zip"])
    part4_country = get_form_value("5.g. Country (Peticionario)", DEFAULT_COMPANY["country"])
    
    # Normalize state and country if provided
    if part4_state and part4_state != DEFAULT_COMPANY["state"]:
        part4_state = normalize_state(part4_state)
    if part4_country and part4_country != DEFAULT_COMPANY["country"]:
        part4_country = normalize_country(part4_country)
    
    # Add company addresses
    # Part 1: subform[0] - Petitioner Mailing Address (US address)
    # Part 3: subform[1] - Beneficiary Mailing Address (also hardcoded to company for this template)
    # Part 4: subform[2] - Petitioner Address when doing business outside US (uses form values or defaults)
    formatted_fields.extend([
        # Part 1 - Petitioner Mailing Address (subform[0])
        {"fieldName": field_mapping["PETITIONER_MAILING_STREET"], "text": DEFAULT_COMPANY["street"]},
        {"fieldName": field_mapping["PETITIONER_MAILING_SUITE"], "text": DEFAULT_COMPANY["suite"]},
        {"fieldName": field_mapping["PETITIONER_SUITE_STE"], "text": "X"},
        {"fieldName": field_mapping["PETITIONER_MAILING_CITY"], "text": DEFAULT_COMPANY["city"]},
        {"fieldName": field_mapping["PETITIONER_MAILING_STATE"], "text": DEFAULT_COMPANY["state"]},
        {"fieldName": field_mapping["PETITIONER_MAILING_ZIP"], "text": DEFAULT_COMPANY["zip"]},
        {"fieldName": field_mapping["PETITIONER_MAILING_COUNTRY"], "text": DEFAULT_COMPANY["country"]},
        
        # Part 3 - Beneficiary Mailing Address (subform[1])
        {"fieldName": field_mapping["BENEFICIARY_MAILING_STREET"], "text": DEFAULT_COMPANY["street"]},
        {"fieldName": field_mapping["BENEFICIARY_MAILING_SUITE"], "text": DEFAULT_COMPANY["suite"]},
        {"fieldName": field_mapping["BENEFICIARY_SUITE_STE"], "text": "X"},
        {"fieldName": field_mapping["BENEFICIARY_MAILING_CITY"], "text": DEFAULT_COMPANY["city"]},
        {"fieldName": field_mapping["BENEFICIARY_MAILING_STATE"], "text": DEFAULT_COMPANY["state"]},
        {"fieldName": field_mapping["BENEFICIARY_MAILING_ZIP"], "text": DEFAULT_COMPANY["zip"]},
        {"fieldName": field_mapping["BENEFICIARY_MAILING_COUNTRY"], "text": DEFAULT_COMPANY["country"]},
        
        # Part 4 - Petitioner Mailing Address when doing business outside US (subform[2])
        # Uses values from form if provided, otherwise defaults
        # Section 5 uses Line3 fields, not Line2
        {"fieldName": field_mapping["PART4_PETITIONER_MAILING_CARE_OF"], "text": part4_care_of},
        {"fieldName": field_mapping["PART4_PETITIONER_MAILING_STREET"], "text": part4_street},
        {"fieldName": field_mapping["PART4_PETITIONER_MAILING_SUITE"], "text": part4_suite},
        {"fieldName": field_mapping["PART4_PETITIONER_SUITE_STE"], "text": "X" if part4_suite else ""},
        {"fieldName": field_mapping["PART4_PETITIONER_MAILING_CITY"], "text": part4_city},
        {"fieldName": field_mapping["PART4_PETITIONER_MAILING_PROVINCE"], "text": part4_state},  # State/Province field
        {"fieldName": field_mapping["PART4_PETITIONER_MAILING_POSTAL"], "text": part4_zip},  # ZIP/Postal field
        {"fieldName": field_mapping["PART4_PETITIONER_MAILING_COUNTRY"], "text": part4_country},
    ])
    
    # === HARDCODED CHECKBOXES ===
    # Part 2, 1.h: NIW (member of professions with advanced degree OR exceptional ability)
    # Based on PDF field analysis: 1.h = prt2PetitionType[6] on page 2 (subform[1])
    formatted_fields.append({"fieldName": "form1[0].#subform[1].prt2PetitionType[6]", "text": "X"})
    
    # Part 4 Processing Information (continued) - Questions 6.a, 8, 9, 10 = No
    # Line4 = Question 6.a: Are you filing any other petitions with this Form I-140? = No
    formatted_fields.append({"fieldName": "form1[0].#subform[2].Line4_No[0]", "text": "X"})
    
    # Line6 = Question 8: Has any immigrant visa petition ever been filed by or on behalf of this person? = No
    formatted_fields.append({"fieldName": "form1[0].#subform[2].Line6_No[0]", "text": "X"})
    
    # Line7 = Question 9: Are you filing without original labor certification because it was previously submitted? = No
    formatted_fields.append({"fieldName": "form1[0].#subform[2].Line7_No[0]", "text": "X"})
    
    # Line8 = Question 10: Are you requesting USCIS to request duplicate labor certification from DOL? = No
    formatted_fields.append({"fieldName": "form1[0].#subform[2].Line8_No[0]", "text": "X"})
    
    # Part 5, 1.b: Self (petitioner is filing for themselves)
    formatted_fields.append({"fieldName": "form1[0].#subform[2].Line1b_Self[0]", "text": "X"})
    
    # === PART 1: Items 5 and 6 (always predefined) ===
    # Part 1, Item 5: Are you a nonprofit tax-exempt or governmental research organization? = No
    formatted_fields.append({"fieldName": "form1[0].#subform[0].P1_Line5_Checkbox[0]", "text": "X"})
    # Part 1, Item 6: Do you currently employ 25 or fewer full-time equivalent employees? = Yes
    formatted_fields.append({"fieldName": "form1[0].#subform[0].P1_Line6_Checkbox[1]", "text": "X"})
    
    # === PART 4, Item 7: Is beneficiary in removal/deportation proceedings? = NO (hardcoded) ===
    # Line5 = Question 7: Is the beneficiary in removal, deportation, rescission, or exclusion proceedings? = No
    formatted_fields.append({"fieldName": "form1[0].#subform[2].Line5_No[0]", "text": "X"})
    
    # === PART 6: Items 4, 6, 7 always YES (hardcoded) ===
    # Part 6 - 4. Is this a full-time position? = Yes
    formatted_fields.append({"fieldName": field_mapping["PART6_FULLTIME_YES"], "text": "X"})
    # Part 6 - 6. Is this a permanent position? = Yes
    formatted_fields.append({"fieldName": field_mapping["PART6_PERMANENT_YES"], "text": "X"})
    # Part 6 - 7. Is this a new position? = Yes
    formatted_fields.append({"fieldName": field_mapping["PART6_NEW_POSITION_YES"], "text": "X"})
    
    # === PART 4: PROCESSING INFORMATION - Visa Processing Type ===
    # Check if user specified processing type from pre-validation form
    processing_answer = get_form_value("¿Dónde procesará la visa el beneficiario?", "")
    
    # Determine processing type
    is_consular = "1.a" in processing_answer or "embajada" in processing_answer.lower() or "consulado" in processing_answer.lower() or "consular" in processing_answer.lower()
    is_usa = "2.a" in processing_answer or "ajuste" in processing_answer.lower() or "eeuu" in processing_answer.lower() or "ee.uu" in processing_answer.lower()
    
    if is_consular:
        # Mark 1.a checkbox for consular processing
        formatted_fields.append({"fieldName": field_mapping["ProcessingType_ConsularProcessing"], "text": "X"})
        
        # Get consular city and country
        consular_city = get_form_value("1.a. Ciudad o Pueblo", "")
        consular_country = get_form_value("1.c. País", "")
        
        if consular_city:
            formatted_fields.append({"fieldName": field_mapping["1.a. Ciudad o Pueblo"], "text": consular_city.upper()})
        if consular_country:
            formatted_fields.append({"fieldName": field_mapping["1.c. País"], "text": normalize_country(consular_country)})
            
    elif is_usa:
        # Mark 2.a checkbox for adjustment of status
        formatted_fields.append({"fieldName": field_mapping["ProcessingType_AdjustmentOfStatus"], "text": "X"})
        
        # Get country of current residence
        foreign_country = get_form_value("2.b. País de residencia actual del beneficiario", "")
        if foreign_country:
            formatted_fields.append({"fieldName": field_mapping["2.b. País de residencia actual del beneficiario"], "text": normalize_country(foreign_country)})
        
        # Get foreign address (last residence abroad) - fields 3.a to 3.f
        foreign_street = get_form_value("3.a. Número y Nombre de la Calle", "")
        foreign_apt = get_form_value("3.b. Apartamento", "")
        foreign_city = get_form_value("3.c. Ciudad", "")
        foreign_province = get_form_value("3.d. Provincia", "")
        foreign_postal = get_form_value("3.e. Código Postal", "")
        foreign_country_addr = get_form_value("3.f. País", "")
        
        if foreign_street:
            formatted_fields.append({"fieldName": field_mapping["3.a. Número y Nombre de la Calle"], "text": foreign_street.upper()})
        if foreign_apt:
            formatted_fields.append({"fieldName": field_mapping["3.b. Apartamento"], "text": foreign_apt.upper()})
        if foreign_city:
            formatted_fields.append({"fieldName": field_mapping["3.c. Ciudad"], "text": foreign_city.upper()})
        if foreign_province:
            formatted_fields.append({"fieldName": field_mapping["3.d. Provincia"], "text": foreign_province.upper()})
        if foreign_postal:
            formatted_fields.append({"fieldName": field_mapping["3.e. Código Postal"], "text": foreign_postal})
        if foreign_country_addr:
            formatted_fields.append({"fieldName": field_mapping["3.f. País"], "text": normalize_country(foreign_country_addr)})

    # === PART 1 & PART 3: BENEFICIARY INFORMATION ===
    # These fields are filled from the pre-validation form and map to both Part 1 (petitioner) and Part 3 (beneficiary)
    # For self-petition (NIW), the petitioner and beneficiary are the same person
    
    # Get beneficiary info from pre-validation form
    beneficiary_last_name = get_form_value("1.a. Apellido del Beneficiario", "")
    beneficiary_first_name = get_form_value("1.b. Nombre del Beneficiario", "")
    beneficiary_middle_name = get_form_value("1.c. Segundo Nombre del Beneficiario", "")
    beneficiary_dob = get_form_value("3. Fecha de Nacimiento", "")
    beneficiary_city_of_birth = get_form_value("4. Ciudad/Pueblo de Nacimiento", "")
    beneficiary_state_of_birth = get_form_value("5. Estado o Provincia de Nacimiento", "")
    beneficiary_country_of_birth = get_form_value("6. País de Nacimiento", "")
    beneficiary_nationality = get_form_value("7. País de Ciudadanía o Nacionalidad", "")
    
    # Also check Part 1 fields (for petitioner - same person in NIW self-petition)
    petitioner_last_name = get_form_value("1.a. Apellido (si es individuo)", "") or beneficiary_last_name
    petitioner_first_name = get_form_value("1.b. Nombre (si es individuo)", "") or beneficiary_first_name
    petitioner_middle_name = get_form_value("1.c. Segundo Nombre (si es individuo)", "") or beneficiary_middle_name
    
    # Fill Part 1 - Petitioner Information (subform[0])
    if petitioner_last_name:
        formatted_fields.append({"fieldName": "form1[0].#subform[0].Pt1Line1a_FamilyName[0]", "text": petitioner_last_name.upper()})
    if petitioner_first_name:
        formatted_fields.append({"fieldName": "form1[0].#subform[0].Pt1Line1b_GivenName[0]", "text": petitioner_first_name.upper()})
    if petitioner_middle_name:
        formatted_fields.append({"fieldName": "form1[0].#subform[0].Pt1Line1c_MiddleName[0]", "text": petitioner_middle_name.upper()})
    
    # Fill Part 3 - Beneficiary Information (subform[1])
    if beneficiary_last_name:
        formatted_fields.append({"fieldName": "form1[0].#subform[1].Pt3Line1a_FamilyName[0]", "text": beneficiary_last_name.upper()})
    if beneficiary_first_name:
        formatted_fields.append({"fieldName": "form1[0].#subform[1].Pt3Line1b_GivenName[0]", "text": beneficiary_first_name.upper()})
    if beneficiary_middle_name:
        formatted_fields.append({"fieldName": "form1[0].#subform[1].Pt3Line1c_MiddleName[0]", "text": beneficiary_middle_name.upper()})
    if beneficiary_dob:
        formatted_fields.append({"fieldName": "form1[0].#subform[1].Line5_DateOfBirth[0]", "text": format_date(beneficiary_dob)})
    if beneficiary_city_of_birth:
        formatted_fields.append({"fieldName": "form1[0].#subform[1].Line6_CityTownOfBirth[0]", "text": beneficiary_city_of_birth.upper()})
    if beneficiary_state_of_birth:
        formatted_fields.append({"fieldName": "form1[0].#subform[1].Line7_StateProvinceOfBirth[0]", "text": beneficiary_state_of_birth.upper()})
    
    # Country of Birth and Nationality - use the values from pre-validation if provided
    if beneficiary_country_of_birth:
        normalized_birth_country = normalize_country(beneficiary_country_of_birth)
        formatted_fields.append({"fieldName": "form1[0].#subform[1].Line8_Country[0]", "text": normalized_birth_country})
    
    if beneficiary_nationality:
        normalized_nationality = normalize_country(beneficiary_nationality)
        formatted_fields.append({"fieldName": "form1[0].#subform[1].Line9_Country[0]", "text": normalized_nationality})
    elif beneficiary_country_of_birth:
        # Fall back to country of birth if nationality not specified
        normalized_birth_country = normalize_country(beneficiary_country_of_birth)
        formatted_fields.append({"fieldName": "form1[0].#subform[1].Line9_Country[0]", "text": normalized_birth_country})

    # === PART 3: Auto-fill item 7 (Nationality) with Country of Birth (item 6) - LEGACY FALLBACK ===
    # Only if not already filled from pre-validation form
    country_of_birth_legacy = get_form_value("6. País de Nacimiento", "")
    if country_of_birth_legacy and not beneficiary_country_of_birth:
        normalized_birth_country = normalize_country(country_of_birth_legacy)
        # Fill both Country of Birth (item 6) and Country of Citizenship (item 7) with the same value
        # PDF field names: Line8_Country[0] for item 6, Line9_Country[0] for item 7
        formatted_fields.append({"fieldName": "form1[0].#subform[1].Line8_Country[0]", "text": normalized_birth_country})
        formatted_fields.append({"fieldName": "form1[0].#subform[1].Line9_Country[0]", "text": normalized_birth_country})

    # === PART 6: BASIC INFORMATION ABOUT THE PROPOSED EMPLOYMENT ===
    # Process Part 6 fields from questionnaire
    part6_job_title = get_form_value("Part 6 - 1. Job Title", "")
    part6_soc_code = get_form_value("Part 6 - 2. SOC Code", "")
    part6_job_description = get_form_value("Part 6 - 3. Nontechnical Job Description", "")
    part6_fulltime = get_form_value("Part 6 - 4. Is this a full-time position?", "")
    part6_hours = get_form_value("Part 6 - 5. Hours per week", "")
    part6_permanent = get_form_value("Part 6 - 6. Is this a permanent position?", "")
    part6_new_position = get_form_value("Part 6 - 7. Is this a new position?", "")
    part6_wages = get_form_value("Part 6 - 8. Wages", "")
    part6_wages_per = get_form_value("Part 6 - 8. Wages Per", "")
    
    # Add Part 6 fields
    if part6_job_title:
        formatted_fields.append({"fieldName": field_mapping["PART6_JOB_TITLE"], "text": part6_job_title})
    
    # SOC Code is in format XX-XXXX, split into two fields
    if part6_soc_code:
        soc_parts = part6_soc_code.replace(" ", "").split("-")
        if len(soc_parts) >= 2:
            formatted_fields.append({"fieldName": field_mapping["PART6_SOC_CODE_1"], "text": soc_parts[0]})
            formatted_fields.append({"fieldName": field_mapping["PART6_SOC_CODE_2"], "text": soc_parts[1]})
        else:
            # If no dash, try to split by position (first 2 chars, rest)
            formatted_fields.append({"fieldName": field_mapping["PART6_SOC_CODE_1"], "text": part6_soc_code[:2]})
            formatted_fields.append({"fieldName": field_mapping["PART6_SOC_CODE_2"], "text": part6_soc_code[2:]})
    
    if part6_job_description:
        formatted_fields.append({"fieldName": field_mapping["PART6_JOB_DESCRIPTION"], "text": part6_job_description})
    
    # Full-time position Yes/No
    if part6_fulltime:
        if part6_fulltime.lower() in ["yes", "sí", "si", "y"]:
            formatted_fields.append({"fieldName": field_mapping["PART6_FULLTIME_YES"], "text": "X"})
        elif part6_fulltime.lower() in ["no", "n"]:
            formatted_fields.append({"fieldName": field_mapping["PART6_FULLTIME_NO"], "text": "X"})
    
    if part6_hours:
        formatted_fields.append({"fieldName": field_mapping["PART6_HOURS_PER_WEEK"], "text": part6_hours})
    
    # Permanent position Yes/No
    if part6_permanent:
        if part6_permanent.lower() in ["yes", "sí", "si", "y"]:
            formatted_fields.append({"fieldName": field_mapping["PART6_PERMANENT_YES"], "text": "X"})
        elif part6_permanent.lower() in ["no", "n"]:
            formatted_fields.append({"fieldName": field_mapping["PART6_PERMANENT_NO"], "text": "X"})
    
    # New position Yes/No
    if part6_new_position:
        if part6_new_position.lower() in ["yes", "sí", "si", "y"]:
            formatted_fields.append({"fieldName": field_mapping["PART6_NEW_POSITION_YES"], "text": "X"})
        elif part6_new_position.lower() in ["no", "n"]:
            formatted_fields.append({"fieldName": field_mapping["PART6_NEW_POSITION_NO"], "text": "X"})
    
    # Wages
    if part6_wages:
        formatted_fields.append({"fieldName": field_mapping["PART6_WAGES"], "text": part6_wages})
    if part6_wages_per:
        formatted_fields.append({"fieldName": field_mapping["PART6_WAGES_PER"], "text": part6_wages_per})
    
    # === PART 7: PERSON 1-6 ADJUSTMENT OF STATUS AND VISA ABROAD ===
    # Process Person 1-6 fields from client questionnaire
    # Map family members from pre-validation form answers
    
    campos_mapeados = 29  # Base: 23 addresses + 6 hardcoded checkboxes
    campos_sin_mapeo = 0
    
    # Field mapping for family members based on person number (from PreValidationFormContent.js)
    # These match the template questions: "Persona X - Apellido", etc.
    person_question_patterns = [
        # Person 1
        {
            "lastName": "Persona 1 - Apellido",
            "firstName": "Persona 1 - Nombre",
            "middleName": "Persona 1 - Segundo Nombre",
            "dob": "Persona 1 - Fecha de Nacimiento",
            "country": "Persona 1 - País de Nacimiento",
            "relationship": "Persona 1 - Relación con el Beneficiario",
            "adjustment": "Persona 1 - Adjustment of Status",
            "visa": "Persona 1 - Visa Abroad"
        },
        # Person 2
        {
            "lastName": "Persona 2 - Apellido",
            "firstName": "Persona 2 - Nombre",
            "middleName": "Persona 2 - Segundo Nombre",
            "dob": "Persona 2 - Fecha de Nacimiento",
            "country": "Persona 2 - País de Nacimiento",
            "relationship": "Persona 2 - Relación con el Beneficiario",
            "adjustment": "Persona 2 - Adjustment of Status",
            "visa": "Persona 2 - Visa Abroad"
        },
        # Person 3
        {
            "lastName": "Persona 3 - Apellido",
            "firstName": "Persona 3 - Nombre",
            "middleName": "Persona 3 - Segundo Nombre",
            "dob": "Persona 3 - Fecha de Nacimiento",
            "country": "Persona 3 - País de Nacimiento",
            "relationship": "Persona 3 - Relación con el Beneficiario",
            "adjustment": "Persona 3 - Adjustment of Status",
            "visa": "Persona 3 - Visa Abroad"
        },
        # Person 4
        {
            "lastName": "Persona 4 - Apellido",
            "firstName": "Persona 4 - Nombre",
            "middleName": "Persona 4 - Segundo Nombre",
            "dob": "Persona 4 - Fecha de Nacimiento",
            "country": "Persona 4 - País de Nacimiento",
            "relationship": "Persona 4 - Relación con el Beneficiario",
            "adjustment": "Persona 4 - Adjustment of Status",
            "visa": "Persona 4 - Visa Abroad"
        },
        # Person 5
        {
            "lastName": "Persona 5 - Apellido",
            "firstName": "Persona 5 - Nombre",
            "middleName": "Persona 5 - Segundo Nombre",
            "dob": "Persona 5 - Fecha de Nacimiento",
            "country": "Persona 5 - País de Nacimiento",
            "relationship": "Persona 5 - Relación con el Beneficiario",
            "adjustment": "Persona 5 - Adjustment of Status",
            "visa": "Persona 5 - Visa Abroad"
        },
        # Person 6
        {
            "lastName": "Persona 6 - Apellido",
            "firstName": "Persona 6 - Nombre",
            "middleName": "Persona 6 - Segundo Nombre",
            "dob": "Persona 6 - Fecha de Nacimiento",
            "country": "Persona 6 - País de Nacimiento",
            "relationship": "Persona 6 - Relación con el Beneficiario",
            "adjustment": "Persona 6 - Adjustment of Status",
            "visa": "Persona 6 - Visa Abroad"
        }
    ]
    
    for person_num, patterns in enumerate(person_question_patterns, 1):
        # Get family member data from filled_form
        last_name = get_form_value(patterns["lastName"], "")
        first_name = get_form_value(patterns["firstName"], "")
        middle_name = get_form_value(patterns["middleName"], "")
        dob = get_form_value(patterns["dob"], "")
        country = get_form_value(patterns["country"], "")
        relationship = get_form_value(patterns["relationship"], "")
        adj_value = get_form_value(patterns["adjustment"], "")
        visa_value = get_form_value(patterns["visa"], "")
        
        # Only process if at least last name or first name is provided
        if last_name or first_name:
            # Map to PDF fields using the existing field_mapping dictionary
            if last_name:
                pdf_field = field_mapping.get(patterns["lastName"])
                if pdf_field:
                    formatted_fields.append({"fieldName": pdf_field, "text": last_name.upper()})
            
            if first_name:
                pdf_field = field_mapping.get(patterns["firstName"])
                if pdf_field:
                    formatted_fields.append({"fieldName": pdf_field, "text": first_name.upper()})
            
            if middle_name:
                pdf_field = field_mapping.get(patterns["middleName"])
                if pdf_field:
                    formatted_fields.append({"fieldName": pdf_field, "text": middle_name.upper()})
            
            if dob:
                pdf_field = field_mapping.get(patterns["dob"])
                if pdf_field:
                    formatted_fields.append({"fieldName": pdf_field, "text": format_date(dob)})
            
            if country:
                pdf_field = field_mapping.get(patterns["country"])
                if pdf_field:
                    formatted_fields.append({"fieldName": pdf_field, "text": normalize_country(country)})
            
            if relationship:
                pdf_field = field_mapping.get(patterns["relationship"])
                if pdf_field:
                    formatted_fields.append({"fieldName": pdf_field, "text": normalize_relationship(relationship)})
            
            # Adjustment of Status - use specific Yes/No field keys
            if adj_value:
                adj_yes_key = f"{patterns['adjustment']}_Yes"
                adj_no_key = f"{patterns['adjustment']}_No"
                if adj_value.lower() in ["yes", "sí", "si", "y"]:
                    pdf_field = field_mapping.get(adj_yes_key)
                    if pdf_field:
                        formatted_fields.append({"fieldName": pdf_field, "text": "X"})
                elif adj_value.lower() in ["no", "n"]:
                    pdf_field = field_mapping.get(adj_no_key)
                    if pdf_field:
                        formatted_fields.append({"fieldName": pdf_field, "text": "X"})
            
            # Visa Abroad - use specific Yes/No field keys
            if visa_value:
                visa_yes_key = f"{patterns['visa']}_Yes"
                visa_no_key = f"{patterns['visa']}_No"
                if visa_value.lower() in ["yes", "sí", "si", "y"]:
                    pdf_field = field_mapping.get(visa_yes_key)
                    if pdf_field:
                        formatted_fields.append({"fieldName": pdf_field, "text": "X"})
                elif visa_value.lower() in ["no", "n"]:
                    pdf_field = field_mapping.get(visa_no_key)
                    if pdf_field:
                        formatted_fields.append({"fieldName": pdf_field, "text": "X"})
            
            campos_mapeados += 1
    
    # Also process the alternate format ("Persona X - Adjustment of Status" / "Persona X - Visa Abroad")
    for person_num in range(1, 7):
        adj_key = f"Persona {person_num} - Adjustment of Status"
        visa_key = f"Persona {person_num} - Visa Abroad"
        
        adj_value = get_form_value(adj_key, "")
        visa_value = get_form_value(visa_key, "")
        
        # Adjustment of Status
        if adj_value:
            if adj_value.lower() in ["yes", "sí", "si", "y"]:
                formatted_fields.append({"fieldName": field_mapping[f"PERSON{person_num}_ADJUSTMENT_YES"], "text": "X"})
            elif adj_value.lower() in ["no", "n"]:
                formatted_fields.append({"fieldName": field_mapping[f"PERSON{person_num}_ADJUSTMENT_NO"], "text": "X"})
        
        # Visa Abroad
        if visa_value:
            if visa_value.lower() in ["yes", "sí", "si", "y"]:
                formatted_fields.append({"fieldName": field_mapping[f"PERSON{person_num}_VISA_ABROAD_YES"], "text": "X"})
            elif visa_value.lower() in ["no", "n"]:
                formatted_fields.append({"fieldName": field_mapping[f"PERSON{person_num}_VISA_ABROAD_NO"], "text": "X"})
    
    # Process dynamic fields
    # Skip Part 4 address fields and Part 7 person fields as they are already processed above
    part4_address_fields = [
        "5.a. In Care Of Name (Peticionario)",
        "5.b. Street Number and Name (Peticionario)",
        "5.c. Suite/Apt/Floor Number (Peticionario)",
        "5.d. City or Town (Peticionario)",
        "5.e. State (Peticionario)",
        "5.f. ZIP Code (Peticionario)",
        "5.g. Country (Peticionario)"
    ]
    
    # Add Part 6 and Part 7 fields to skip list
    part6_fields = [
        "Part 6 - 1. Job Title", "Part 6 - 2. SOC Code", "Part 6 - 3. Nontechnical Job Description",
        "Part 6 - 4. Is this a full-time position?", "Part 6 - 5. Hours per week",
        "Part 6 - 6. Is this a permanent position?", "Part 6 - 7. Is this a new position?",
        "Part 6 - 8. Wages", "Part 6 - 8. Wages Per"
    ]
    
    part7_fields = [f"Persona {i} - Adjustment of Status" for i in range(1, 7)] + \
                   [f"Persona {i} - Visa Abroad" for i in range(1, 7)]
    
    # Add family member fields that are already processed above
    family_member_fields = []
    for person_num, patterns in enumerate(person_question_patterns, 1):
        family_member_fields.extend([
            patterns["lastName"], patterns["firstName"], patterns["middleName"],
            patterns["dob"], patterns["country"], patterns["relationship"],
            patterns["adjustment"], patterns["visa"]
        ])
    
    # Also add Part 3 fields that are auto-filled (Country of Birth auto-fills Nationality)
    # And beneficiary info fields that are already processed above
    part3_auto_fields = [
        "1.a. Apellido del Beneficiario",
        "1.b. Nombre del Beneficiario",
        "1.c. Segundo Nombre del Beneficiario",
        "3. Fecha de Nacimiento",
        "4. Ciudad/Pueblo de Nacimiento",
        "5. Estado o Provincia de Nacimiento",
        "6. País de Nacimiento",
        "7. País de Ciudadanía o Nacionalidad"
    ]
    
    skip_fields = part4_address_fields + part6_fields + part7_fields + family_member_fields + part3_auto_fields + [
        "¿Dónde procesará la visa el beneficiario?",
        "1.a. Ciudad o Pueblo",
        "1.c. País",
    ]
    
    for key, raw_value in filled_form.items():
        # Skip already processed fields
        if key in skip_fields:
            continue
            
        value = normalize_value(raw_value)
        pdf_field_name = field_mapping.get(key)
        
        # Skip empty or informational fields
        if not value or value.upper() in ["NA", "N/A"] or \
           "INFORMACIÓN DE" in key or \
           ("PERSONA" in key and "information" in value.lower()) or \
           ("PERSONA" in key and "COMPLETE SOLO SI APLICA" in value.upper()):
            continue
        
        # Country normalization
        if ("País" in key or "Country" in key) and value:
            normalized_country = normalize_country(value)
            if pdf_field_name and normalized_country:
                formatted_fields.append({"fieldName": pdf_field_name, "text": normalized_country})
                campos_mapeados += 1
            continue
        
        # Suite/Apt for beneficiary mailing address
        if (key == "2.c. Suite/Apt/Floor Number (Beneficiario)" or 
            "Dirección - Apartamento/Suite" in key) and value and pdf_field_name:
            formatted_fields.append({"fieldName": pdf_field_name, "text": value})
            value_lower = value.lower()
            if "suite" in value_lower or "ste" in value_lower:
                formatted_fields.append({"fieldName": field_mapping["BENEFICIARY_SUITE_STE"], "text": "X"})
            elif "apt" in value_lower or "apartment" in value_lower:
                formatted_fields.append({"fieldName": field_mapping["BENEFICIARY_SUITE_APT"], "text": "X"})
            elif "flr" in value_lower or "floor" in value_lower:
                formatted_fields.append({"fieldName": field_mapping["BENEFICIARY_SUITE_FLR"], "text": "X"})
            campos_mapeados += 2
            continue
        
        # A-Number for beneficiary (remove "A-" prefix)
        if "A-Number del Beneficiario" in key and value and pdf_field_name:
            clean_a = clean_a_number(value)
            formatted_fields.append({"fieldName": pdf_field_name, "text": clean_a})
            campos_mapeados += 1
            continue
        
        # Foreign address with checkboxes
        if (key == "3.b. Apartamento" or key == "3.b. Apt") and value and pdf_field_name:
            formatted_fields.append({"fieldName": pdf_field_name, "text": value})
            value_lower = value.lower()
            if "suite" in value_lower or "ste" in value_lower:
                formatted_fields.append({"fieldName": field_mapping["FOREIGN_ADDRESS_STE"], "text": "X"})
            elif "apt" in value_lower or "apartment" in value_lower:
                formatted_fields.append({"fieldName": field_mapping["FOREIGN_ADDRESS_APT"], "text": "X"})
            elif "flr" in value_lower or "floor" in value_lower:
                formatted_fields.append({"fieldName": field_mapping["FOREIGN_ADDRESS_FLR"], "text": "X"})
            campos_mapeados += 2
            continue
        
        # Worksite suite/apt
        if key == "9.b. Apartamento, Suite, Piso" and value and pdf_field_name:
            formatted_fields.append({"fieldName": pdf_field_name, "text": value})
            value_lower = value.lower()
            if "suite" in value_lower or "ste" in value_lower:
                formatted_fields.append({"fieldName": field_mapping["WORK_SUITE_STE"], "text": "X"})
            elif "apt" in value_lower or "apartment" in value_lower:
                formatted_fields.append({"fieldName": field_mapping["WORK_SUITE_APT"], "text": "X"})
            elif "flr" in value_lower or "floor" in value_lower:
                formatted_fields.append({"fieldName": field_mapping["WORK_SUITE_FLR"], "text": "X"})
            campos_mapeados += 2
            continue
        
        # State normalization
        if key == "9.d. Estado" and value and pdf_field_name:
            normalized_state = normalize_state(value)
            formatted_fields.append({"fieldName": pdf_field_name, "text": normalized_state})
            campos_mapeados += 1
            continue
        
        # NIW checkbox
        if key == "Seleccione la 'X' si esta usted aplicando a una visa EB-2 NIW" and value == "X":
            formatted_fields.append({"fieldName": field_mapping["PetitionType_NIW"], "text": "X"})
            campos_mapeados += 1
            continue
        
        # Petition type detection
        if key == "Seleccione el tipo de petición (SOLO UNA OPCIÓN)":
            petition_type = detect_petition_type(value)
            if petition_type and field_mapping.get(f"PetitionType_{petition_type}"):
                formatted_fields.append({"fieldName": field_mapping[f"PetitionType_{petition_type}"], "text": "X"})
                campos_mapeados += 1
            continue
        
        # Yes/No questions
        yes_no_patterns = [
            "¿Es una organización sin fines de lucro",
            "¿Emplea actualmente un total de 25",
            "¿Está presentando otras solicitudes",
            "¿Está el beneficiario en proceso",
            "¿Se ha presentado antes una petición",
            "¿Presenta sin cert. laboral original",
            "¿Solicita que USCIS pida un duplicado",
            "¿Solicitará ajuste de estatus?",
            "¿Solicitará visa en el extranjero?",
            "Is this a full-time position?",
            "Is this a permanent position?",
            "Is this a new position?"
        ]
        
        is_yes_no_question = any(pattern in key for pattern in yes_no_patterns)
        
        if is_yes_no_question:
            normalized_value = normalize_yes_no(value)
            yes_field = field_mapping.get(key + "_Yes")
            no_field = field_mapping.get(key + "_No")
            
            if normalized_value == "Yes" and yes_field:
                formatted_fields.append({"fieldName": yes_field, "text": "X"})
                campos_mapeados += 1
            elif normalized_value == "No" and no_field:
                formatted_fields.append({"fieldName": no_field, "text": "X"})
                campos_mapeados += 1
            continue
        
        # Petitioner type
        if key == "Tipo de peticionario":
            petitioner_type = detect_petitioner_type(value)
            if petitioner_type and field_mapping.get(f"PetitionerType_{petitioner_type}"):
                formatted_fields.append({"fieldName": field_mapping[f"PetitionerType_{petitioner_type}"], "text": "X"})
                campos_mapeados += 1
            continue
        
        # Visa processing
        if key == "¿Dónde procesará la visa el beneficiario?":
            processing_type = detect_visa_processing(value)
            if processing_type and field_mapping.get(f"ProcessingType_{processing_type}"):
                formatted_fields.append({"fieldName": field_mapping[f"ProcessingType_{processing_type}"], "text": "X"})
                campos_mapeados += 1
            continue
        
        # Dates
        if ("fecha" in key.lower() or "date" in key.lower()) and value:
            if pdf_field_name:
                formatted_date = format_date(value)
                if formatted_date:
                    formatted_fields.append({"fieldName": pdf_field_name, "text": formatted_date})
                    campos_mapeados += 1
            continue
        
        # Relationships
        if "Relación" in key and value:
            mapped_relationship = normalize_relationship(value)
            if pdf_field_name and mapped_relationship:
                formatted_fields.append({"fieldName": pdf_field_name, "text": mapped_relationship})
                campos_mapeados += 1
            continue
        
        # A-Number
        if "A-Number" in key or "Alien Registration" in key:
            cleaned_a_number = clean_a_number(value)
            if pdf_field_name and cleaned_a_number:
                formatted_fields.append({"fieldName": pdf_field_name, "text": cleaned_a_number})
                campos_mapeados += 1
            continue
        
        # Phone numbers
        if "Teléfono" in key:
            cleaned_phone = clean_phone_number(value)
            if pdf_field_name and cleaned_phone:
                formatted_fields.append({"fieldName": pdf_field_name, "text": cleaned_phone})
                campos_mapeados += 1
            continue
        
        # General fields
        if pdf_field_name and value:
            clean_value = value
            if "Ciudad" in key or "Estado" in key:
                clean_value = value.split(',')[0].strip()
            
            formatted_fields.append({"fieldName": pdf_field_name, "text": clean_value})
            campos_mapeados += 1
        elif not pdf_field_name and value:
            campos_sin_mapeo += 1
    
    return {
        "fields": formatted_fields,
        "debug": {
            "totalCamposFormulario": len(filled_form),
            "camposMapeados": campos_mapeados,
            "camposSinMapeo": campos_sin_mapeo,
            "direccionesHardcodeadas": "Direcciones de empresa agregadas",
            "versionFinal": "Versión final N8N completamente portada a Python"
        }
    }
