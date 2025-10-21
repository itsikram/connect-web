import React from 'react';

const PortfolioAbout = () => {
    return (
        <section id='about' className='portfolio-section'>
            <h2 className='section-title'>About Me</h2>
            <p className='section-subtitle'>Senior Software Developer with expertise in WordPress and MERN Stack development.</p>

            <div className='about-grid'>
                <div className='about-card'>
                    <h3 className='color-wh'>Career Objectives</h3>
                    <p className='color-tc'>
                        Experienced WordPress And MERN Developer with 5 years of expertise in custom theme development, 
                        plugin creation, website optimization and React Native Mobile App Development. Seeking a challenging 
                        role where I can lead projects, enhance user experience, and implement innovative solutions to improve 
                        web performance and functionality.
                    </p>
                </div>
                <div className='about-card'>
                    <h3 className='color-wh'>Personal Information</h3>
                    <p className='color-tc'><strong>Name:</strong> Md Ikram</p>
                    <p className='color-tc'><strong>Date of Birth:</strong> 16/07/2003</p>
                    <p className='color-tc'><strong>Religion:</strong> Islam</p>
                    <p className='color-tc'><strong>Nationality:</strong> Bangladeshi</p>
                    <p className='color-tc'><strong>Location:</strong> Munshiganj, Bangladesh</p>
                </div>
                <div className='about-card'>
                    <h3 className='color-wh'>Key Strengths</h3>
                    <ul className='color-tc' style={{paddingLeft: '20px'}}>
                        <li>Hard Worker, Honest, Punctual and Responsible</li>
                        <li>Hard working and Complex Problem Solving</li>
                        <li>Willing to accept responsibility and perform accordingly even under pressure</li>
                    </ul>
                </div>
                <div className='about-card'>
                    <h3 className='color-wh'>Interests and Hobbies</h3>
                    <p className='color-tc'>Programming, Photography, Travel, AI</p>
                    <h3 className='color-wh mt-3'>Languages</h3>
                    <p className='color-tc'>Proficiency in writing, reading and speaking both in Bengali and English</p>
                </div>
            </div>
        </section>
    );
}

export default PortfolioAbout;
