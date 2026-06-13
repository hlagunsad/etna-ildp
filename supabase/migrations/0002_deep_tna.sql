-- eTNA → ILDP — Deep TNA: multiple yes/no "Can I…?" items per competency, tagged by level.
-- Run ONCE in the Supabase SQL editor AFTER 0001 (and before the redeploy + re-seed).
-- Additive and idempotent (the WHERE NOT EXISTS guard makes re-runs safe).
-- Items are derived from the freely-reusable DICT NICS behavioral indicators.

alter table public.assessment_item
  add column if not exists level_id uuid references public.proficiency_level(id);

insert into public.assessment_item (competency_id, prompt_text, response_type, level_id)
select c.id, v.prompt_text, 'yes_no', pl.id
from (values
  -- Communicating and Collaborating Using Technology
  ('NICS-COMMCOLLAB', 1, 'Can I send clear emails and messages using appropriate tone and platforms?'),
  ('NICS-COMMCOLLAB', 1, 'Can I participate in video conferencing and group discussions with colleagues?'),
  ('NICS-COMMCOLLAB', 1, 'Can I share files securely with authorized stakeholders through proper channels?'),
  ('NICS-COMMCOLLAB', 2, 'Can I choose the right digital communication tool for different stakeholders and situations?'),
  ('NICS-COMMCOLLAB', 2, 'Can I create detailed messages and proposals via appropriate digital platforms?'),
  ('NICS-COMMCOLLAB', 2, 'Can I use team collaboration platforms to coordinate discussions and updates effectively?'),
  ('NICS-COMMCOLLAB', 3, 'Can I integrate multiple digital tools to suit diverse collaborative needs and solve workflow problems?'),
  ('NICS-COMMCOLLAB', 3, 'Can I recommend improvements to how our team uses digital communication tools?'),
  ('NICS-COMMCOLLAB', 3, 'Can I train and support colleagues in adopting new collaboration tools and practices?'),
  -- ICT Literacy
  ('NICS-ICTLIT', 1, 'Can I open, close, and navigate applications on computers and mobile devices?'),
  ('NICS-ICTLIT', 1, 'Can I safely install and update applications with guidance from IT support?'),
  ('NICS-ICTLIT', 1, 'Can I browse the web and conduct basic online research using a web browser?'),
  ('NICS-ICTLIT', 2, 'Can I use software applications and resolve technical issues with minimal support?'),
  ('NICS-ICTLIT', 2, 'Can I adapt to new technologies and productivity tools introduced at work?'),
  ('NICS-ICTLIT', 2, 'Can I manage and organize files across local drives and cloud storage systems?'),
  ('NICS-ICTLIT', 3, 'Can I diagnose and resolve technical issues independently on computers and mobile devices?'),
  ('NICS-ICTLIT', 3, 'Can I research and recommend new technologies that could improve business processes?'),
  ('NICS-ICTLIT', 3, 'Can I efficiently organize complex file structures and sharing systems across platforms?'),
  -- Digital Literacy
  ('NICS-DIGLIT', 1, 'Can I access and retrieve information from reliable sources and validate news through research?'),
  ('NICS-DIGLIT', 1, 'Can I distinguish authentic content from misinformation and manage information via documentation?'),
  ('NICS-DIGLIT', 1, 'Can I integrate researched data into reports and documents appropriately?'),
  ('NICS-DIGLIT', 2, 'Can I access information from diverse sources with focus on reliability and work relevance?'),
  ('NICS-DIGLIT', 2, 'Can I interpret digital content and connect insights across different datasets?'),
  ('NICS-DIGLIT', 2, 'Can I apply newly processed information to reports and presentations with practical recommendations?'),
  ('NICS-DIGLIT', 3, 'Can I employ advanced search strategies and build organized information management systems?'),
  ('NICS-DIGLIT', 3, 'Can I interpret digital content in specialized work contexts and derive organizational insights?'),
  ('NICS-DIGLIT', 3, 'Can I communicate complex findings to diverse audiences and mentor colleagues in digital literacy?'),
  -- Cybersecurity
  ('NICS-CYBERSEC', 1, 'Can I identify common risks and threats to my devices and ICT assets?'),
  ('NICS-CYBERSEC', 1, 'Can I follow strong password practices and use measures like two-factor authentication?'),
  ('NICS-CYBERSEC', 1, 'Can I recognize and report security incidents or breaches promptly?'),
  ('NICS-CYBERSEC', 2, 'Can I protect issued ICT resources using antivirus software and authorized applications responsibly?'),
  ('NICS-CYBERSEC', 2, 'Can I identify advanced risks and analyze their impact on organizational assets with guidance?'),
  ('NICS-CYBERSEC', 2, 'Can I troubleshoot security issues with help from authorized IT personnel?'),
  ('NICS-CYBERSEC', 3, 'Can I promote cybersecurity policies and drive continuous improvement of security systems?'),
  ('NICS-CYBERSEC', 3, 'Can I establish relationships with external security experts and authorities?'),
  ('NICS-CYBERSEC', 3, 'Can I champion organizational adherence to cybersecurity laws and regulatory requirements?'),
  -- Information Security
  ('NICS-INFOSEC', 1, 'Can I identify common risks to information assets and follow basic information security policies?'),
  ('NICS-INFOSEC', 1, 'Can I recognize confidential, internal, and public information categories?'),
  ('NICS-INFOSEC', 1, 'Can I store and share information only with authorized individuals through secure channels?'),
  ('NICS-INFOSEC', 2, 'Can I identify advanced risks and analyze their impact on organizational information assets?'),
  ('NICS-INFOSEC', 2, 'Can I implement information security programs with guidance from authorized IT groups?'),
  ('NICS-INFOSEC', 2, 'Can I conduct regular information security awareness sessions for employees?'),
  ('NICS-INFOSEC', 3, 'Can I drive continuous improvement of information security policies and systems?'),
  ('NICS-INFOSEC', 3, 'Can I establish and maintain relationships with external security experts and authorities?'),
  ('NICS-INFOSEC', 3, 'Can I integrate advanced encryption and access controls across organizational information systems?'),
  -- Content Processing and Generation
  ('NICS-CONTENT', 1, 'Can I create basic documents, reports, and memos using word processing tools?'),
  ('NICS-CONTENT', 1, 'Can I do basic data entry, sorting, and filtering in spreadsheets with simple calculations?'),
  ('NICS-CONTENT', 1, 'Can I design basic visual content like posters and social media cards using design apps?'),
  ('NICS-CONTENT', 2, 'Can I create documents with advanced formatting and analyze data with specialized spreadsheet functions?'),
  ('NICS-CONTENT', 2, 'Can I design appealing presentations with multimedia elements and animations?'),
  ('NICS-CONTENT', 2, 'Can I develop basic videos using available photos, videos, and audio in editing applications?'),
  ('NICS-CONTENT', 3, 'Can I create comprehensive reports with advanced formatting and high-quality, complex graphics?'),
  ('NICS-CONTENT', 3, 'Can I process and analyze multiple datasets using advanced spreadsheet features and automation?'),
  ('NICS-CONTENT', 3, 'Can I produce high-quality video and audio content with professional editing, effects, and transitions?'),
  -- Data Analysis
  ('NICS-DATA', 1, 'Can I recognize the problems or issues guiding a data analysis task?'),
  ('NICS-DATA', 1, 'Can I gather data from credible sources using appropriate methodologies with guidance?'),
  ('NICS-DATA', 1, 'Can I ensure data quality by identifying and removing inconsistencies and duplicates?'),
  ('NICS-DATA', 2, 'Can I articulate the problems data analysis should address and identify credible data sources?'),
  ('NICS-DATA', 2, 'Can I use advanced spreadsheet functions to ensure data consistency and cleanliness?'),
  ('NICS-DATA', 2, 'Can I identify trends and patterns across datasets and apply basic statistical analysis?'),
  ('NICS-DATA', 3, 'Can I define analysis objectives and provide strategies for data-driven projects and research?'),
  ('NICS-DATA', 3, 'Can I develop predictive models and conduct advanced exploratory analysis on complex datasets?'),
  ('NICS-DATA', 3, 'Can I create compelling data visualizations that facilitate understanding and decision-making?'),
  -- Information Systems Management
  ('NICS-ISM', 1, 'Can I follow established procedures for system operation and data entry?'),
  ('NICS-ISM', 1, 'Can I seek appropriate assistance for complex tasks or technical issues with systems?'),
  ('NICS-ISM', 1, 'Can I learn and apply the basic features of standard business information systems?'),
  ('NICS-ISM', 2, 'Can I perform advanced functions in standard information systems?'),
  ('NICS-ISM', 2, 'Can I independently resolve routine technical issues and help colleagues with system use?'),
  ('NICS-ISM', 2, 'Can I adapt to new features or updates in information systems as they are introduced?'),
  ('NICS-ISM', 3, 'Can I identify opportunities for system enhancements and customization?'),
  ('NICS-ISM', 3, 'Can I act as a subject matter expert and mentor colleagues in effective system use?'),
  ('NICS-ISM', 3, 'Can I recommend improvements to information systems and business processes?'),
  -- Project Management
  ('NICS-PM', 1, 'Can I complete assigned tasks with supervisor guidance and deliver outputs on time?'),
  ('NICS-PM', 1, 'Can I support delivering project requirements in collaboration with team members?'),
  ('NICS-PM', 1, 'Can I regularly communicate project updates to supervisors and team members?'),
  ('NICS-PM', 2, 'Can I actively contribute to project planning, including timelines, requirements, and deliverables?'),
  ('NICS-PM', 2, 'Can I implement approved project plans with guidance and ensure quality of deliverables?'),
  ('NICS-PM', 2, 'Can I collaborate with project stakeholders to ensure alignment with project scope?'),
  ('NICS-PM', 3, 'Can I craft comprehensive project charters including stakeholders, risks, budget, and business case?'),
  ('NICS-PM', 3, 'Can I strategically plan project implementation addressing scope, timelines, quality, and risk?'),
  ('NICS-PM', 3, 'Can I oversee project implementation and promote effective communication across all levels?'),
  -- Customer Focus
  ('NICS-CUSTFOCUS', 1, 'Can I listen actively, show empathy, and stay patient when addressing customer concerns?'),
  ('NICS-CUSTFOCUS', 1, 'Can I provide accurate and relevant information to customers in a clear manner?'),
  ('NICS-CUSTFOCUS', 1, 'Can I respond promptly to requests and follow established protocols for routine inquiries?'),
  ('NICS-CUSTFOCUS', 2, 'Can I identify customer needs and offer suitable solutions or options?'),
  ('NICS-CUSTFOCUS', 2, 'Can I collaborate with colleagues and cross-functional teams to resolve complex issues?'),
  ('NICS-CUSTFOCUS', 2, 'Can I personalize interactions based on the requirements and preferences of different customers?'),
  ('NICS-CUSTFOCUS', 3, 'Can I act as a mentor, sharing customer service best practices and insights with colleagues?'),
  ('NICS-CUSTFOCUS', 3, 'Can I advocate for customer-centric improvements and influence organizational policy?'),
  ('NICS-CUSTFOCUS', 3, 'Can I develop and champion strategies that enhance customer satisfaction and efficiency?')
) as v(code, level_rank, prompt_text)
join public.competency c on c.code = v.code
join public.proficiency_level pl
  on pl.scale_id = '00000000-0000-0000-0000-0000000000aa' and pl.rank = v.level_rank
where not exists (
  select 1 from public.assessment_item ai
  where ai.competency_id = c.id
    and ai.prompt_text = v.prompt_text
    and ai.response_type = 'yes_no'
);
