import {
  Document,
  Link,
  Page,
  StyleSheet,
  Text,
  View
} from '@react-pdf/renderer';
import { groupResumeExperience } from '../../features/resume/resumeExport';
import type { ResumeSafeViewModel } from '../../features/resume/resumeExport';

const styles = StyleSheet.create({
  page: {
    color: '#172033',
    fontFamily: 'Helvetica',
    fontSize: 9.5,
    lineHeight: 1.35,
    paddingBottom: 38,
    paddingHorizontal: 42,
    paddingTop: 36
  },
  header: { borderBottomColor: '#5b6ff0', borderBottomWidth: 1.5, marginBottom: 14, paddingBottom: 10 },
  name: { fontFamily: 'Helvetica-Bold', fontSize: 22, letterSpacing: 0.2, marginBottom: 4 },
  headline: { color: '#3f4d68', fontFamily: 'Helvetica-Bold', fontSize: 10.5, marginBottom: 5 },
  contact: { color: '#4d5b74', flexDirection: 'row', flexWrap: 'wrap', gap: 7 },
  contactLink: { color: '#3d52c9', textDecoration: 'none' },
  section: { marginBottom: 11 },
  sectionTitle: {
    color: '#3d52c9',
    fontFamily: 'Helvetica-Bold',
    fontSize: 10,
    letterSpacing: 0.8,
    marginBottom: 6,
    textTransform: 'uppercase'
  },
  item: { marginBottom: 7 },
  itemHeader: { flexDirection: 'row', gap: 10, justifyContent: 'space-between' },
  itemTitle: { flexGrow: 1, fontFamily: 'Helvetica-Bold', fontSize: 10.5 },
  itemDate: { color: '#5b667b', flexShrink: 0, fontSize: 9 },
  itemMeta: { color: '#4d5b74', marginBottom: 2 },
  bulletRow: { flexDirection: 'row', marginTop: 1, paddingLeft: 5 },
  bullet: { marginRight: 5, width: 5 },
  bulletText: { flex: 1 },
  skills: { flexDirection: 'row', flexWrap: 'wrap', gap: 5 },
  skill: { backgroundColor: '#eef0ff', borderRadius: 2, paddingHorizontal: 5, paddingVertical: 2 }
});

const Details = ({ lines }: { lines: string[] }) => lines.map((line, index) => (
  <View key={`${line}-${index}`} style={styles.bulletRow} wrap={false}>
    <Text style={styles.bullet}>•</Text>
    <Text style={styles.bulletText}>{line}</Text>
  </View>
));

export default function ResumePdfDocument({ model }: { model: ResumeSafeViewModel }) {
  const contactItems = [model.contact.email, model.contact.phone, model.contact.location].filter(Boolean);
  const experienceGroups = groupResumeExperience(model.experience);
  return (
    <Document title={`${model.contact.name || 'ApplyFill'} Resume`}>
      <Page size="LETTER" style={styles.page}>
        <View style={styles.header}>
          <Text style={styles.name}>{model.contact.name || 'Your Name'}</Text>
          {model.title ? <Text style={styles.headline}>{model.title}</Text> : null}
          <View style={styles.contact}>
            {contactItems.map((item) => <Text key={item}>{item}</Text>)}
            {model.contact.links.map((link) => (
              <Link key={link.url} src={link.url} style={styles.contactLink}>{link.label}</Link>
            ))}
          </View>
        </View>

        {model.summary ? (
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Professional Summary</Text>
            <Text>{model.summary}</Text>
          </View>
        ) : null}

        {model.experience.length ? (
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Experience</Text>
            {experienceGroups.map((roles) => (
              <View key={roles[0].employmentGroupId} style={styles.item}>
                <Text style={styles.itemTitle}>{roles[0].company}</Text>
                <Text style={styles.itemMeta}>{roles[0].location}</Text>
                {roles.map((item) => (
                  <View key={`${item.employmentGroupId}-${item.jobTitle}-${item.dateRange}`} wrap={false}>
                    <View style={styles.itemHeader}>
                      <Text style={styles.itemTitle}>{item.jobTitle}</Text>
                      <Text style={styles.itemDate}>{item.dateRange}</Text>
                    </View>
                    <Details lines={item.details} />
                  </View>
                ))}
              </View>
            ))}
          </View>
        ) : null}

        {model.credentials.length ? (
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Certifications &amp; Licenses</Text>
            {model.credentials.map((item, index) => (
              <View key={`${item.name}-${index}`} style={styles.item} wrap={false}>
                <View style={styles.itemHeader}>
                  <Text style={styles.itemTitle}>{item.name}</Text>
                  <Text style={styles.itemDate}>{item.dateRange}</Text>
                </View>
                <Text style={styles.itemMeta}>{[item.type, item.issuer, item.credentialId].filter(Boolean).join(' · ')}</Text>
                <Details lines={item.details} />
              </View>
            ))}
          </View>
        ) : null}

        {model.projects.length ? (
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Projects</Text>
            {model.projects.map((item, index) => (
              <View key={`${item.name}-${index}`} style={styles.item} wrap={false}>
                <View style={styles.itemHeader}>
                  <Text style={styles.itemTitle}>{item.name}</Text>
                  <Text style={styles.itemDate}>{item.dateRange}</Text>
                </View>
                <Text style={styles.itemMeta}>{[item.role, item.organization, item.projectType].filter(Boolean).join(' · ')}</Text>
                <Details lines={item.details} />
              </View>
            ))}
          </View>
        ) : null}

        {model.education.length ? (
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Education</Text>
            {model.education.map((item, index) => (
              <View key={`${item.provider}-${index}`} style={styles.item} wrap={false}>
                <View style={styles.itemHeader}>
                  <Text style={styles.itemTitle}>{[item.credential, item.fieldOfStudy].filter(Boolean).join(' in ')}</Text>
                  <Text style={styles.itemDate}>{item.dateRange}</Text>
                </View>
                <Text style={styles.itemMeta}>{[item.provider, item.location, item.gpa ? `GPA ${item.gpa}` : ''].filter(Boolean).join(' · ')}</Text>
                <Details lines={item.details} />
              </View>
            ))}
          </View>
        ) : null}

        {model.skills.length ? (
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Skills</Text>
            <View style={styles.skills}>
              {model.skills.map((skill) => <Text key={skill} style={styles.skill}>{skill}</Text>)}
            </View>
          </View>
        ) : null}
      </Page>
    </Document>
  );
}
