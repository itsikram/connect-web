import { FaFacebook, FaLinkedin, FaGithub, FaTwitter } from 'react-icons/fa';

const defaults = {
  facebook: 'https://facebook.com/programmerikram',
  linkedin: 'https://www.linkedin.com/in/ikramul-islam-38a484260/',
  github: 'https://github.com/itsikram',
};

export default function SocialIcons({ social }) {
  const links = {
    facebook: social?.facebook || defaults.facebook,
    linkedin: social?.linkedin || defaults.linkedin,
    github: social?.github || defaults.github,
    twitter: social?.twitter || '',
  };

  return (
    <div className="flex space-x-4" aria-label="Social links">
      {links.facebook ? (
        <a href={links.facebook} target="_blank" rel="noopener noreferrer" aria-label="Facebook">
          <FaFacebook size={22} />
        </a>
      ) : null}
      {links.linkedin ? (
        <a href={links.linkedin} target="_blank" rel="noopener noreferrer" aria-label="LinkedIn">
          <FaLinkedin size={22} />
        </a>
      ) : null}
      {links.github ? (
        <a href={links.github} target="_blank" rel="noopener noreferrer" aria-label="GitHub">
          <FaGithub size={22} />
        </a>
      ) : null}
      {links.twitter ? (
        <a href={links.twitter} target="_blank" rel="noopener noreferrer" aria-label="Twitter">
          <FaTwitter size={22} />
        </a>
      ) : null}
    </div>
  );
}
